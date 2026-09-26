require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌  GEMINI_API_KEY is not set. Create a .env file — see .env.example.");
  process.exit(1);
}

// Use the model confirmed available for this API key
const MODEL = "gemini-3.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ─── Schema definition (used in prompt) ────────────────────────────────────
const RECIPE_SCHEMA = `{
  "title": "string",
  "description": "string (1-2 sentences)",
  "servings": number,
  "prepTime": "string (e.g. '10 minutes')",
  "cookTime": "string (e.g. '25 minutes')",
  "difficulty": "Easy | Medium | Hard",
  "ingredients": [
    {
      "id": "string (unique, e.g. 'ing-0')",
      "name": "string",
      "amount": number,
      "unit": "string (e.g. 'g', 'cup', 'tbsp', '' for items like 'eggs')",
      "swaps": ["string", "..."] // 1-3 swap suggestions
    }
  ],
  "steps": [
    {
      "id": "string (unique, e.g. 'step-0')",
      "order": number,
      "text": "string",
      "tip": "string | null"
    }
  ],
  "tags": ["string"]
}`;

// ─── POST /api/recipe  (streaming via SSE) ──────────────────────────────────
app.post("/api/recipe", async (req, res) => {
  const { ingredients, requestId } = req.body;

  if (!ingredients || typeof ingredients !== "string" || ingredients.trim().length === 0) {
    return res.status(400).json({ error: "ingredients field is required" });
  }

  if (ingredients.trim().length > 2000) {
    return res.status(400).json({ error: "Input too long (max 2000 chars)" });
  }

  // SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Request-Id", requestId || "");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const prompt = `You are a creative chef assistant. Given the following ingredients, generate ONE complete recipe.

Ingredients the user has: ${ingredients.trim()}

Return ONLY valid JSON that matches this exact schema (no markdown, no code fences, no extra text):
${RECIPE_SCHEMA}

Rules:
- Use as many of the listed ingredients as possible.
- "servings" must be a plain integer (e.g. 4).
- "amount" must be a plain number (e.g. 1.5 — NOT "1.5 cups"; put units in "unit").
- Every ingredient and step must have a unique "id" string.
- swaps should be realistic and commonly available alternatives.
- Respond with ONLY the JSON object. No explanation. No markdown fences.`;

  try {
    // Call Gemini REST API directly with streaming enabled
    const geminiRes = await fetch(
      `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      let errMsg = `Gemini API error (${geminiRes.status})`;
      try {
        const j = JSON.parse(errBody);
        errMsg = j.error?.message || errMsg;
      } catch { }
      console.error("Gemini HTTP error:", errMsg);
      const isQuota = geminiRes.status === 429;
      sendEvent("error", {
        message: isQuota
          ? "API rate limit reached. Please wait a moment and retry."
          : `AI service error: ${errMsg}`,
        requestId,
      });
      return res.end();
    }

    // ── Read SSE stream from Gemini and pipe to client ──────────────────────
    let buffer = "";
    let accumulatedText = "";
    const decoder = new TextDecoder();

    for await (const chunk of geminiRes.body) {
      buffer += decoder.decode(chunk, { stream: true });

      // Gemini SSE: events split by \r\n\r\n or \n\n, each line is "data: {...}"
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop(); // keep incomplete last part

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Each part may have one or more "data: ..." lines
        for (const line of trimmed.split(/\r?\n/)) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          let payload;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          // Extract text from Gemini's response structure
          const newText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (newText) {
            accumulatedText += newText;
            // Forward chunk to client
            sendEvent("chunk", { text: newText });
          }
        }
      }
    }

    // ── Validate accumulated JSON ───────────────────────────────────────────
    if (!accumulatedText.trim()) {
      sendEvent("error", {
        message: "The AI returned an empty response. Please retry.",
        requestId,
      });
      return res.end();
    }

    try {
      const cleaned = accumulatedText
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      validateRecipeShape(parsed);
      sendEvent("done", { requestId });
    } catch (parseErr) {
      sendEvent("error", {
        message: "The model returned malformed data. Please retry.",
        detail: parseErr.message,
        requestId,
      });
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    sendEvent("error", {
      message: "An unexpected error occurred. Please retry.",
      detail: err.message,
      requestId,
    });
  } finally {
    res.end();
  }
});

// ─── Shape validator ─────────────────────────────────────────────────────────
function validateRecipeShape(obj) {
  if (typeof obj !== "object" || obj === null) throw new Error("Response is not an object");
  const required = ["title", "description", "servings", "ingredients", "steps"];
  for (const key of required) {
    if (!(key in obj)) throw new Error(`Missing required field: "${key}"`);
  }
  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0)
    throw new Error("ingredients must be a non-empty array");
  if (!Array.isArray(obj.steps) || obj.steps.length === 0)
    throw new Error("steps must be a non-empty array");
  for (const ing of obj.ingredients) {
    if (!ing.id || !ing.name) throw new Error("Each ingredient must have id and name");
  }
  for (const step of obj.steps) {
    if (!step.id || !step.text) throw new Error("Each step must have id and text");
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

app.listen(PORT, () => {
  console.log(`✅  Backend running on http://localhost:3001 (model: ${MODEL})`);
});

/**
 * api/recipe.js  — Vercel Serverless Function
 *
 * This is the Express /api/recipe route rewritten as a Vercel Edge-compatible
 * serverless function. It streams the Gemini response back to the client using
 * the same SSE protocol the frontend already understands.
 *
 * Vercel sets process.env.GEMINI_API_KEY from the project's Environment Variables
 * dashboard — the key is never exposed to the browser.
 */

const MODEL = "gemini-3.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ─── Schema ──────────────────────────────────────────────────────────────────
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
      "unit": "string",
      "swaps": ["string"]
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

// ─── Helper: send SSE event into a WritableStream ─────────────────────────────
function sseEvent(writer, encoder, event, data) {
  writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

// ─── Vercel handler (Edge Runtime) ───────────────────────────────────────────
export const config = { runtime: "edge" };

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { ingredients, requestId } = body;

  if (!ingredients || typeof ingredients !== "string" || !ingredients.trim()) {
    return new Response(JSON.stringify({ error: "ingredients field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (ingredients.trim().length > 2000) {
    return new Response(JSON.stringify({ error: "Input too long (max 2000 chars)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  // Create a TransformStream to pipe the SSE response
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Run async in background so we can return the stream immediately
  (async () => {
    try {
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
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        let errMsg = `Gemini API error (${geminiRes.status})`;
        try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch {}
        sseEvent(writer, encoder, "error", {
          message: geminiRes.status === 429
            ? "API rate limit reached. Please wait and retry."
            : `AI service error: ${errMsg}`,
          requestId,
        });
        return;
      }

      let buffer = "";
      let accumulatedText = "";
      const dec = new TextDecoder();

      for await (const chunk of geminiRes.body) {
        buffer += dec.decode(chunk, { stream: true });

        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop();

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          for (const line of trimmed.split(/\r?\n/)) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;
            let payload;
            try { payload = JSON.parse(dataStr); } catch { continue; }
            const newText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (newText) {
              accumulatedText += newText;
              sseEvent(writer, encoder, "chunk", { text: newText });
            }
          }
        }
      }

      if (!accumulatedText.trim()) {
        sseEvent(writer, encoder, "error", {
          message: "The AI returned an empty response. Please retry.",
          requestId,
        });
        return;
      }

      try {
        const cleaned = accumulatedText
          .replace(/^```(?:json)?\s*/im, "")
          .replace(/\s*```\s*$/m, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        validateRecipeShape(parsed);
        sseEvent(writer, encoder, "done", { requestId });
      } catch (e) {
        sseEvent(writer, encoder, "error", {
          message: "The model returned malformed data. Please retry.",
          detail: e.message,
          requestId,
        });
      }
    } catch (err) {
      sseEvent(writer, encoder, "error", {
        message: "An unexpected error occurred. Please retry.",
        detail: err.message,
        requestId,
      });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Request-Id": requestId || "",
    },
  });
}

/**
 * recipeApi.js
 * Handles the streaming request to /api/recipe.
 * Keeps the API key on the backend (routed through Vite proxy).
 *
 * Design decisions:
 *  - Uses AbortController to cancel stale in-flight requests.
 *  - Parses SSE events manually so we can handle chunk/done/error.
 *  - Strips accidental markdown fences the model sometimes emits.
 *  - Validates the JSON shape before returning it.
 */

const BACKEND = '/api/recipe';
const TIMEOUT_MS = 45_000;

// ─── Shape Validator (client-side mirror of server-side) ─────────────────────
function validateRecipeShape(obj) {
  if (typeof obj !== 'object' || obj === null) throw new Error('Response is not an object');
  const required = ['title', 'description', 'servings', 'ingredients', 'steps'];
  for (const key of required) {
    if (!(key in obj)) throw new Error(`Missing required field: "${key}"`);
  }
  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0)
    throw new Error('ingredients must be a non-empty array');
  if (!Array.isArray(obj.steps) || obj.steps.length === 0)
    throw new Error('steps must be a non-empty array');

  // Normalise missing optional fields to safe defaults
  obj.ingredients = obj.ingredients.map((ing, i) => ({
    id: ing.id ?? `ing-${i}`,
    name: ing.name ?? 'Unknown',
    amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 0,
    unit: ing.unit ?? '',
    swaps: Array.isArray(ing.swaps) ? ing.swaps : [],
  }));

  obj.steps = obj.steps.map((step, i) => ({
    id: step.id ?? `step-${i}`,
    order: typeof step.order === 'number' ? step.order : i + 1,
    text: step.text ?? '',
    tip: step.tip ?? null,
  }));

  obj.tags = Array.isArray(obj.tags) ? obj.tags : [];
  obj.difficulty = obj.difficulty ?? 'Medium';
  obj.prepTime = obj.prepTime ?? null;
  obj.cookTime = obj.cookTime ?? null;

  return obj;
}

// ─── Clean stray markdown fences ─────────────────────────────────────────────
function cleanJsonString(str) {
  return str
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
}

/**
 * fetchRecipe — streams the recipe from the backend.
 *
 * @param {string} ingredients - raw text from the user
 * @param {AbortSignal} signal  - AbortController signal for cancellation
 * @param {{ onChunk: (text: string) => void }} callbacks
 * @returns {Promise<object>} - validated recipe object
 */
export async function fetchRecipe(ingredients, signal, { onChunk } = {}) {
  const requestId = crypto.randomUUID();

  let res;
  try {
    const timeoutId = setTimeout(() => {
      // Create a custom abort reason so the caller can distinguish timeout
      signal.dispatchEvent(new Event('timeout'));
    }, TIMEOUT_MS);

    res = await fetch(BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, requestId }),
      signal,
    });

    clearTimeout(timeoutId);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new RecipeError('Request was cancelled.', 'CANCELLED');
    }
    throw new RecipeError(
      'Could not reach the server. Make sure the backend is running on port 3001.',
      'NETWORK'
    );
  }

  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error || ''; } catch {}
    if (res.status === 429) throw new RecipeError('API rate limit reached. Please wait and retry.', 'RATE_LIMIT');
    if (res.status === 400) throw new RecipeError(detail || 'Invalid request.', 'BAD_INPUT');
    throw new RecipeError(`Server error (${res.status}). Please retry.`, 'SERVER');
  }

  // ── Stream SSE ────────────────────────────────────────────────────────────
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedJson = '';
  let serverError = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // last incomplete chunk stays in buffer

      for (const part of parts) {
        const lines = part.trim().split('\n');
        let eventName = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
        }

        if (!dataStr) continue;

        let payload;
        try { payload = JSON.parse(dataStr); } catch { continue; }

        if (eventName === 'chunk') {
          accumulatedJson += payload.text || '';
          onChunk?.(payload.text || '');
        } else if (eventName === 'error') {
          serverError = payload;
        } else if (eventName === 'done') {
          // Server validated — now client validates too
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new RecipeError('Request was cancelled.', 'CANCELLED');
    throw new RecipeError('Stream interrupted. Please retry.', 'STREAM');
  } finally {
    reader.releaseLock();
  }

  if (serverError) {
    throw new RecipeError(serverError.message || 'AI returned an error.', 'AI_ERROR');
  }

  if (!accumulatedJson.trim()) {
    throw new RecipeError('The AI returned an empty response. Please retry.', 'EMPTY');
  }

  // ── Parse + validate ──────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(cleanJsonString(accumulatedJson));
  } catch (err) {
    throw new RecipeError(
      'The AI returned malformed JSON. Please retry — this sometimes happens with complex inputs.',
      'PARSE'
    );
  }

  try {
    parsed = validateRecipeShape(parsed);
  } catch (err) {
    throw new RecipeError(
      `The AI response was missing required fields (${err.message}). Please retry.`,
      'SHAPE'
    );
  }

  return parsed;
}

// ─── Custom Error Class ───────────────────────────────────────────────────────
export class RecipeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RecipeError';
    this.code = code; // CANCELLED | NETWORK | RATE_LIMIT | BAD_INPUT | SERVER | STREAM | EMPTY | PARSE | SHAPE | AI_ERROR
  }
}

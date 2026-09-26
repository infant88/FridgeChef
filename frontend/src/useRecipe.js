/**
 * useRecipe.js
 * Central state machine for the recipe feature.
 * Handles: loading, streaming, error, parsed recipe, and retry.
 *
 * Race condition prevention: each call gets a unique generationId.
 * If the component calls generateRecipe again before the first resolves,
 * the AbortController cancels the old request.
 */
import { useState, useRef, useCallback } from 'react';
import { fetchRecipe, RecipeError } from './recipeApi';

export function useRecipe() {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [recipe, setRecipe] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [streamBuffer, setStreamBuffer] = useState('');

  // Holds the AbortController for the in-flight request
  const abortRef = useRef(null);

  const generateRecipe = useCallback(async (ingredients) => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setErrorMsg('');
    setStreamBuffer('');
    setRecipe(null);

    try {
      const result = await fetchRecipe(
        ingredients,
        controller.signal,
        {
          onChunk: (text) => {
            // Only update stream buffer if this request is still active
            if (!controller.signal.aborted) {
              setStreamBuffer((prev) => prev + text);
            }
          },
        }
      );

      // Guard: if another request was fired while this one was running, ignore
      if (controller.signal.aborted) return;

      setRecipe(result);
      setStatus('success');
    } catch (err) {
      if (controller.signal.aborted) return; // Silently ignore cancelled requests
      setErrorMsg(err.message || 'An unexpected error occurred. Please retry.');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setStatus('idle');
    setRecipe(null);
    setErrorMsg('');
    setStreamBuffer('');
  }, []);

  return { status, recipe, errorMsg, streamBuffer, generateRecipe, reset };
}

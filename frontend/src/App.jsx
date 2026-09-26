/**
 * App.jsx
 * Root component — wires together all states:
 *   idle → loading (streaming) → success | error
 *
 * Dark mode is stored in localStorage and toggled via a header button.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRecipe } from './useRecipe';
import IngredientInput from './components/IngredientInput';
import LoadingView from './components/LoadingView';
import ErrorView from './components/ErrorView';
import RecipeView from './components/RecipeView';

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, setDark];
}

export default function App() {
  const [dark, setDark] = useDarkMode();
  const { status, recipe, errorMsg, streamBuffer, generateRecipe, reset } = useRecipe();

  // Keep track of last ingredients so Retry can resubmit
  const [lastIngredients, setLastIngredients] = useState('');

  const handleSubmit = useCallback((ingredients) => {
    setLastIngredients(ingredients);
    generateRecipe(ingredients);
  }, [generateRecipe]);

  const handleRetry = useCallback(() => {
    if (lastIngredients) generateRecipe(lastIngredients);
  }, [lastIngredients, generateRecipe]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  const isLoading = status === 'loading';

  return (
    <div className="app">
      {/* ─── Header ─── */}
      <header className="header">
        <a href="/" className="header-brand" aria-label="FridgeChef home">
          <div className="header-logo" aria-hidden="true">🍽️</div>
          <span className="header-title">FridgeChef</span>
        </a>
        <div className="header-actions">
          {status !== 'idle' && (
            <button
              className="icon-btn"
              onClick={reset}
              aria-label="Start over with new ingredients"
              title="New recipe"
            >
              ✦
            </button>
          )}
          <button
            id="theme-toggle"
            className="icon-btn"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title="Toggle dark mode"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="main" id="main-content">
        {/* Hero — only shown when idle */}
        {status === 'idle' && (
          <div className="hero">
            <span className="hero-emoji" aria-hidden="true">🧑‍🍳</span>
            <h1 className="hero-heading">
              Turn your fridge into a <span>masterpiece</span>
            </h1>
            <p className="hero-sub">
              List the ingredients you have and we'll generate a beautiful, interactive recipe — just for you.
            </p>
          </div>
        )}

        {/* Input form — shown when idle or after error */}
        {(status === 'idle' || status === 'error') && (
          <IngredientInput onSubmit={handleSubmit} isLoading={isLoading} />
        )}

        {/* Error state */}
        {status === 'error' && (
          <ErrorView
            message={errorMsg}
            onRetry={lastIngredients ? handleRetry : undefined}
            onDismiss={reset}
          />
        )}

        {/* Loading + streaming */}
        {status === 'loading' && (
          <LoadingView streamBuffer={streamBuffer} onCancel={handleCancel} />
        )}

        {/* Success */}
        {status === 'success' && recipe && (
          <RecipeView recipe={recipe} onReset={reset} />
        )}
      </main>
    </div>
  );
}

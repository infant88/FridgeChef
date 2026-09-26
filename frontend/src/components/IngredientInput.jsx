/**
 * IngredientInput.jsx
 * Free-form text area for the user's ingredients.
 */
import { useState } from 'react';

const MAX_LEN = 2000;
const EXAMPLES = [
  'chicken breast, garlic, lemon, rosemary',
  'pasta, tomatoes, basil, mozzarella',
  'eggs, spinach, feta, bell pepper',
  'salmon, soy sauce, ginger, sesame',
  'black beans, corn, avocado, lime',
];

export default function IngredientInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('');

  const charCount = value.length;
  const countClass = charCount > MAX_LEN ? 'error' : charCount > MAX_LEN * 0.85 ? 'warn' : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading || charCount > MAX_LEN) return;
    onSubmit(trimmed);
  };

  const fillExample = (ex) => {
    setValue(ex);
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Ingredient input form">
      <div className="examples">
        <span className="examples-label">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            onClick={() => fillExample(ex)}
            aria-label={`Fill example: ${ex}`}
          >
            {ex.split(',')[0].trim()}…
          </button>
        ))}
      </div>

      <div className="input-card">
        <label className="input-label" htmlFor="ingredient-field">
          What's in your fridge?
        </label>
        <textarea
          id="ingredient-field"
          className="ingredient-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. chicken breast, garlic, lemon, rosemary, olive oil, potatoes…"
          rows={5}
          aria-describedby="char-count"
          maxLength={MAX_LEN + 100}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
          }}
        />

        <div className="input-footer">
          <span
            id="char-count"
            className={`char-count ${countClass}`}
            aria-live="polite"
          >
            {charCount}/{MAX_LEN} · Press Ctrl+Enter to submit
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!value.trim() || isLoading || charCount > MAX_LEN}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                Generating…
              </>
            ) : (
              <>🍳 Generate Recipe</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

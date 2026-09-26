/**
 * ServingScaler.jsx
 * +/- scaler that updates serving counts and ingredient amounts.
 */
export default function ServingScaler({ baseServings, multiplier, onChange }) {
  const currentServings = Math.round(baseServings * multiplier);
  const ratios = [0.5, 1, 1.5, 2, 3, 4];

  return (
    <div className="scaler" role="group" aria-label="Serving scaler">
      <button
        className="scaler-btn"
        onClick={() => {
          const idx = ratios.indexOf(multiplier);
          if (idx > 0) onChange(ratios[idx - 1]);
        }}
        disabled={multiplier <= ratios[0]}
        aria-label="Decrease servings"
      >
        −
      </button>
      <span className="scaler-value" aria-live="polite" aria-atomic="true">
        {currentServings} {currentServings === 1 ? 'serving' : 'servings'}
      </span>
      <button
        className="scaler-btn"
        onClick={() => {
          const idx = ratios.indexOf(multiplier);
          if (idx < ratios.length - 1) onChange(ratios[idx + 1]);
        }}
        disabled={multiplier >= ratios[ratios.length - 1]}
        aria-label="Increase servings"
      >
        +
      </button>
    </div>
  );
}

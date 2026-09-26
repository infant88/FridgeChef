/**
 * RecipeView.jsx
 * The interactive recipe display:
 *  - Scalable servings
 *  - Checkable ingredients with swap support
 *  - Checkable step-by-step instructions
 *  - Progress bar
 *  - Completion banner
 */
import { useState, useCallback } from 'react';
import ServingScaler from './ServingScaler';
import SwapPopover from './SwapPopover';

function formatAmount(amount, multiplier) {
  const scaled = amount * multiplier;
  // Return clean fractional string where useful
  if (scaled === 0) return '–';
  if (Number.isInteger(scaled)) return String(scaled);
  // Round to 2 decimal places, strip trailing zeros
  return parseFloat(scaled.toFixed(2)).toString();
}

const DIFFICULTY_EMOJI = { Easy: '🟢', Medium: '🟡', Hard: '🔴' };

export default function RecipeView({ recipe: initialRecipe, onReset }) {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [checkedSteps, setCheckedSteps] = useState(new Set());
  const [multiplier, setMultiplier] = useState(1);
  const [swapTarget, setSwapTarget] = useState(null); // ingredient id

  // ── Ingredient toggle ─────────────────────────────────────────────────────
  const toggleIngredient = useCallback((id) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Step toggle ───────────────────────────────────────────────────────────
  const toggleStep = useCallback((id) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Ingredient swap ───────────────────────────────────────────────────────
  const applySwap = useCallback((ingredientId, swapName) => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === ingredientId ? { ...ing, name: swapName, swaps: [] } : ing
      ),
    }));
    setSwapTarget(null);
  }, []);

  const swapTargetIngredient = recipe.ingredients.find((i) => i.id === swapTarget);

  // ── Progress ──────────────────────────────────────────────────────────────
  const totalSteps = recipe.steps.length;
  const doneSteps = checkedSteps.size;
  const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const isComplete = doneSteps === totalSteps && totalSteps > 0;

  const difficultyClass = `difficulty-${recipe.difficulty?.toLowerCase() || 'medium'}`;

  return (
    <div className="recipe-wrap">
      {/* ─── Recipe Header ─── */}
      <div className="recipe-header-card">
        {recipe.tags?.length > 0 && (
          <div className="recipe-tags" aria-label="Recipe tags">
            {recipe.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
        <h1 className="recipe-title">{recipe.title}</h1>
        <p className="recipe-desc">{recipe.description}</p>
        <div className="recipe-meta">
          <span className="meta-chip">
            <span className="meta-chip-icon">👥</span>
            {recipe.servings} servings (base)
          </span>
          {recipe.prepTime && (
            <span className="meta-chip">
              <span className="meta-chip-icon">⏱️</span>
              Prep: {recipe.prepTime}
            </span>
          )}
          {recipe.cookTime && (
            <span className="meta-chip">
              <span className="meta-chip-icon">🔥</span>
              Cook: {recipe.cookTime}
            </span>
          )}
          {recipe.difficulty && (
            <span className={`meta-chip ${difficultyClass}`}>
              <span className="meta-chip-icon">{DIFFICULTY_EMOJI[recipe.difficulty] || '⚪'}</span>
              {recipe.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* ─── Progress ─── */}
      <div className="progress-bar-wrap">
        <div className="progress-label">
          <span>Cooking Progress</span>
          <span>{pct}% complete</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Recipe progress">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ─── Ingredients ─── */}
      <section className="section-card" aria-labelledby="ingredients-title">
        <div className="section-header">
          <h2 className="section-title" id="ingredients-title">
            🛒 Ingredients
          </h2>
          <ServingScaler
            baseServings={recipe.servings}
            multiplier={multiplier}
            onChange={setMultiplier}
          />
        </div>

        <ul className="ingredient-list" aria-label="Ingredient checklist">
          {recipe.ingredients.map((ing) => {
            const isChecked = checkedIngredients.has(ing.id);
            return (
              <li key={ing.id}>
                <div
                  className={`ingredient-row ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleIngredient(ing.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleIngredient(ing.id); }}}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  aria-label={`${ing.name}, ${formatAmount(ing.amount, multiplier)} ${ing.unit}`}
                >
                  <span className="ingredient-check" aria-hidden="true">
                    <span className="ingredient-check-icon">✓</span>
                  </span>
                  <span className="ingredient-amount" aria-hidden="true">
                    {formatAmount(ing.amount, multiplier)}{ing.unit ? ` ${ing.unit}` : ''}
                  </span>
                  <span className="ingredient-name">{ing.name}</span>
                  {ing.swaps?.length > 0 && (
                    <button
                      className="swap-btn"
                      onClick={(e) => { e.stopPropagation(); setSwapTarget(ing.id); }}
                      aria-label={`Show swaps for ${ing.name}`}
                      tabIndex={0}
                    >
                      swap ↕
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── Steps ─── */}
      <section className="section-card" aria-labelledby="steps-title">
        <div className="section-header">
          <h2 className="section-title" id="steps-title">
            👨‍🍳 Instructions
          </h2>
          {doneSteps > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem' }}
              onClick={() => setCheckedSteps(new Set())}
              aria-label="Reset all steps"
            >
              Reset
            </button>
          )}
        </div>

        <ol className="steps-list" aria-label="Cooking steps">
          {recipe.steps
            .sort((a, b) => a.order - b.order)
            .map((step) => {
              const isDone = checkedSteps.has(step.id);
              return (
                <li key={step.id}>
                  <div
                    className={`step-row ${isDone ? 'step-done' : ''}`}
                    onClick={() => toggleStep(step.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStep(step.id); }}}
                    role="checkbox"
                    aria-checked={isDone}
                    tabIndex={0}
                    aria-label={`Step ${step.order}: ${step.text}`}
                  >
                    <span className="step-num" aria-hidden="true">
                      {isDone ? '✓' : step.order}
                    </span>
                    <div className="step-content">
                      <p className="step-text">{step.text}</p>
                      {step.tip && (
                        <span className="step-tip">
                          💡 <em>{step.tip}</em>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
        </ol>

        {isComplete && (
          <div className="done-banner" role="status" aria-live="polite">
            <h3>🎉 Enjoy your meal!</h3>
            <p>You've completed all the steps. Bon appétit!</p>
          </div>
        )}
      </section>

      {/* ─── Footer Actions ─── */}
      <div className="recipe-footer-actions">
        <button className="btn btn-ghost" onClick={onReset}>
          ← Try Different Ingredients
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setCheckedIngredients(new Set());
            setCheckedSteps(new Set());
            setMultiplier(1);
          }}
        >
          🔄 Reset Progress
        </button>
      </div>

      {/* ─── Swap Popover ─── */}
      {swapTarget && swapTargetIngredient && (
        <SwapPopover
          ingredient={swapTargetIngredient}
          onSwap={applySwap}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  );
}

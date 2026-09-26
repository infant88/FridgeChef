/**
 * SwapPopover.jsx
 * Modal bottom sheet showing swap suggestions for an ingredient.
 */
import { useEffect, useRef } from 'react';

export default function SwapPopover({ ingredient, onSwap, onClose }) {
  const firstBtnRef = useRef(null);

  // Trap focus & close on Escape
  useEffect(() => {
    firstBtnRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!ingredient || !ingredient.swaps?.length) return null;

  return (
    <div
      className="swap-popover-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Swap options for ${ingredient.name}`}
    >
      <div className="swap-popover">
        <p className="swap-popover-title">Swap {ingredient.name}</p>
        <p className="swap-popover-sub">Choose a substitute to use instead:</p>
        {ingredient.swaps.map((swap, i) => (
          <button
            key={swap}
            ref={i === 0 ? firstBtnRef : null}
            className="swap-option"
            onClick={() => onSwap(ingredient.id, swap)}
          >
            {swap}
          </button>
        ))}
        <button className="btn btn-ghost swap-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

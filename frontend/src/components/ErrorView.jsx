/**
 * ErrorView.jsx
 * Displays a categorised error message with retry/dismiss actions.
 */
export default function ErrorView({ message, onRetry, onDismiss }) {
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <span className="error-icon" aria-hidden="true">⚠️</span>
      <div className="error-body">
        <p className="error-title">Something went wrong</p>
        <p className="error-detail">{message}</p>
        <div className="error-actions">
          {onRetry && (
            <button className="btn btn-primary" onClick={onRetry} aria-label="Retry generating recipe">
              🔄 Try Again
            </button>
          )}
          {onDismiss && (
            <button className="btn btn-ghost" onClick={onDismiss} aria-label="Dismiss error">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

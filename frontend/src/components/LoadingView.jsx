/**
 * LoadingView.jsx
 * Shows a spinner + live streaming JSON preview while waiting for the AI.
 */
export default function LoadingView({ streamBuffer, onCancel }) {
  const previewText = streamBuffer.slice(-500); // last 500 chars

  return (
    <div className="loading-wrap" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p className="loading-title">✨ Cooking up your recipe…</p>
      <p className="loading-sub">
        Gemini is generating your personalised recipe. This usually takes 5–15 seconds.
      </p>

      {streamBuffer && (
        <div className="streaming-preview" aria-label="AI response preview">
          <pre className="streaming-text">
            {previewText}
            <span className="streaming-cursor" aria-hidden="true" />
          </pre>
        </div>
      )}

      <button
        className="btn btn-ghost"
        style={{ marginTop: '1.25rem' }}
        onClick={onCancel}
        aria-label="Cancel recipe generation"
      >
        Cancel
      </button>
    </div>
  );
}

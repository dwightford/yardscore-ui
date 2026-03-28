"use client";

/**
 * Route-level error boundary for the App Router.
 * Catches any uncaught error thrown inside a page or component within the
 * root layout. Renders visible text instead of a blank white screen.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 480,
        margin: "40px auto",
      }}
    >
      <p style={{ color: "#999", fontSize: 11, marginBottom: 8 }}>ys:error-boundary</p>
      <h2 style={{ color: "#b91c1c", marginBottom: 8 }}>Something went wrong</h2>
      <pre
        style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#7f1d1d",
          marginBottom: 16,
        }}
      >
        {error.message || "Unknown error"}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        style={{
          background: "#2d6a4f",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 20px",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
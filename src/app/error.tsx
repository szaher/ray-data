"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-8">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

"use client";

interface VoiceControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  isSupported: boolean;
  speed: number;
  currentSectionIndex: number;
  totalSections: number;
  onPlayAll: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCycleSpeed: () => void;
}

export default function VoiceControls({
  isPlaying,
  isPaused,
  isSupported,
  speed,
  currentSectionIndex,
  totalSections,
  onPlayAll,
  onPause,
  onResume,
  onStop,
  onCycleSpeed,
}: VoiceControlsProps) {
  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-1.5">
      {isPlaying ? (
        <>
          <button
            onClick={isPaused ? onResume : onPause}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-white/[0.04] transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16" />
                <rect x="15" y="4" width="4" height="16" />
              </svg>
            )}
          </button>
          <button
            onClick={onStop}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-white/[0.04] transition-colors"
            title="Stop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
          <span className="text-xs text-[var(--text-secondary)] ml-1">
            {currentSectionIndex + 1}/{totalSections}
          </span>
        </>
      ) : (
        <button
          onClick={onPlayAll}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-white/[0.04] transition-colors"
          title="Read aloud"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
      )}

      <button
        onClick={onCycleSpeed}
        className="px-1.5 py-0.5 rounded text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
        title="Change speed"
      >
        {speed}x
      </button>
    </div>
  );
}

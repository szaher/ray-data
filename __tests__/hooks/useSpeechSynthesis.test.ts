import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { chunkBySentence, useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { SpeechSection } from "@/lib/speech";

// ── Mock speechSynthesis and SpeechSynthesisUtterance ───────────

let utterances: Array<{
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}> = [];

class MockUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  speak: vi.fn((u: MockUtterance) => {
    utterances.push({
      text: u.text,
      rate: u.rate,
      pitch: u.pitch,
      volume: u.volume,
      voice: u.voice,
      onend: u.onend,
      onerror: u.onerror,
    });
  }),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

function makeSections(count: number): SpeechSection[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `section-${i}`,
    heading: `Section ${i + 1}`,
    headingElement: document.createElement("h2"),
    text: `This is the body of section ${i + 1}. It has multiple sentences. Here is a third one.`,
    level: 2,
  }));
}

function fireUtteranceEnd(index: number) {
  utterances[index]?.onend?.();
}

beforeEach(() => {
  vi.useFakeTimers();
  utterances = [];
  vi.stubGlobal("speechSynthesis", mockSpeechSynthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  mockSpeechSynthesis.speak.mockClear();
  mockSpeechSynthesis.cancel.mockClear();
  mockSpeechSynthesis.pause.mockClear();
  mockSpeechSynthesis.resume.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── chunkBySentence unit tests ──────────────────────────────────

describe("chunkBySentence", () => {
  it("returns empty array for empty/whitespace input", () => {
    expect(chunkBySentence("")).toEqual([]);
    expect(chunkBySentence("   ")).toEqual([]);
  });

  it("preserves abbreviations Dr., Mr., Mrs., Ms., Prof.", () => {
    const text = "Dr. Smith met Mr. Jones at the lab. They discussed the results.";
    const chunks = chunkBySentence(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join(" ")).toContain("Dr. Smith");
    expect(chunks.join(" ")).toContain("Mr. Jones");
  });

  it("preserves multi-period abbreviations e.g., U.S., i.e.", () => {
    const text = "The U.S. economy grew, e.g. in the tech sector. This is notable.";
    const chunks = chunkBySentence(text);
    const joined = chunks.join(" ");
    expect(joined).toContain("U.S.");
    expect(joined).toContain("e.g.");
  });

  it("preserves decimal numbers like 3.14", () => {
    const text = "Pi is approximately 3.14. This is well known.";
    const chunks = chunkBySentence(text);
    expect(chunks.join(" ")).toContain("3.14");
  });

  it("preserves ellipsis", () => {
    const text = "And then... it happened. The end arrived.";
    const chunks = chunkBySentence(text);
    expect(chunks.join(" ")).toContain("...");
  });

  it("batches sentences up to ~200 words", () => {
    const sentence = "Word ".repeat(50).trim() + ". ";
    const text = sentence.repeat(5);
    const chunks = chunkBySentence(text);
    for (const chunk of chunks) {
      const words = chunk.split(/\s+/).filter(Boolean).length;
      expect(words).toBeLessThanOrEqual(200);
    }
  });

  it("splits a single oversized sentence by words", () => {
    const text = "Word ".repeat(250).trim() + ".";
    const chunks = chunkBySentence(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const words = chunk.split(/\s+/).filter(Boolean).length;
      expect(words).toBeLessThanOrEqual(200);
    }
  });

  it("handles normal multi-sentence text correctly", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const chunks = chunkBySentence(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const joined = chunks.join(" ");
    expect(joined).toContain("First sentence.");
    expect(joined).toContain("Second sentence.");
    expect(joined).toContain("Third sentence.");
  });
});

// ── Prosody tests ───────────────────────────────────────────────

describe("useSpeechSynthesis prosody", () => {
  it("speaks heading at pitch 1.05 and body at pitch 1.0, all volume 1.0", () => {
    const sections = makeSections(1);
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.playAll(sections);
    });

    expect(utterances.length).toBe(1);
    expect(utterances[0].pitch).toBe(1.05);
    expect(utterances[0].volume).toBe(1.0);

    act(() => {
      fireUtteranceEnd(0);
    });
    vi.advanceTimersByTime(300);

    expect(utterances.length).toBe(2);
    expect(utterances[1].pitch).toBe(1.0);
    expect(utterances[1].volume).toBe(1.0);
  });
});

// ── Timing tests ────────────────────────────────────────────────

describe("useSpeechSynthesis timing", () => {
  it("waits 300ms between chunks within a section", () => {
    const sections = makeSections(1);
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.playAll(sections);
    });

    const initialCount = utterances.length;
    act(() => {
      fireUtteranceEnd(0);
    });

    expect(utterances.length).toBe(initialCount);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(utterances.length).toBe(initialCount);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(utterances.length).toBe(initialCount + 1);
  });

  it("waits 600ms between sections but first section is immediate", () => {
    const sections: SpeechSection[] = [
      {
        id: "s1",
        heading: "First",
        headingElement: document.createElement("h2"),
        text: "One sentence only.",
        level: 2,
      },
      {
        id: "s2",
        heading: "Second",
        headingElement: document.createElement("h2"),
        text: "Another sentence.",
        level: 2,
      },
    ];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.playAll(sections);
    });

    // First section starts immediately: heading utterance
    expect(utterances.length).toBe(1);
    expect(utterances[0].text).toBe("First.");

    // Complete heading -> 300ms -> body
    act(() => { fireUtteranceEnd(0); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(utterances.length).toBe(2);
    expect(utterances[1].text).toBe("One sentence only.");

    // Complete body -> section 1 done, now 600ms inter-section pause
    act(() => { fireUtteranceEnd(1); });

    const countAfterSection1 = utterances.length;

    // 599ms — still waiting
    act(() => { vi.advanceTimersByTime(599); });
    expect(utterances.length).toBe(countAfterSection1);

    // At 600ms — section 2 starts
    act(() => { vi.advanceTimersByTime(1); });
    expect(utterances.length).toBeGreaterThan(countAfterSection1);
    expect(utterances[countAfterSection1].text).toBe("Second.");
  });
});

// ── Stop during timeout ─────────────────────────────────────────

describe("useSpeechSynthesis stop", () => {
  it("produces no later utterance when stopped during a chunk delay", () => {
    const onEnd = vi.fn();
    const sections = makeSections(1);
    const { result } = renderHook(() => useSpeechSynthesis({ onEnd }));

    act(() => {
      result.current.playAll(sections);
    });

    act(() => {
      fireUtteranceEnd(0);
    });

    const countBeforeStop = utterances.length;

    act(() => {
      result.current.stop();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(utterances.length).toBe(countBeforeStop);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("invokes onEnd exactly once on normal completion", () => {
    const onEnd = vi.fn();
    const sections: SpeechSection[] = [
      {
        id: "s1",
        heading: "Title",
        headingElement: document.createElement("h2"),
        text: "Single short sentence.",
        level: 2,
      },
    ];
    const { result } = renderHook(() => useSpeechSynthesis({ onEnd }));

    act(() => {
      result.current.playAll(sections);
    });

    // heading utterance
    act(() => {
      fireUtteranceEnd(0);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // body utterance
    act(() => {
      fireUtteranceEnd(1);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

// ── Race prevention ─────────────────────────────────────────────

describe("useSpeechSynthesis race prevention", () => {
  it("starting narration B during A's delay does not resume A", () => {
    const sections1 = makeSections(1);
    const sections2: SpeechSection[] = [
      {
        id: "b1",
        heading: "New Topic",
        headingElement: document.createElement("h2"),
        text: "Different content entirely.",
        level: 2,
      },
    ];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.playAll(sections1);
    });

    act(() => {
      fireUtteranceEnd(0);
    });

    // Now mid-delay for section 1's next chunk. Start narration B.
    act(() => {
      result.current.playAll(sections2);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The latest utterance should be from sections2, not sections1
    const lastUtterance = utterances[utterances.length - 1];
    expect(lastUtterance.text).toBe("New Topic.");
  });
});

// ── Pause during delay ──────────────────────────────────────────

describe("useSpeechSynthesis pause during delay", () => {
  it("preserves remaining delay on pause and resumes correctly", () => {
    const sections = makeSections(1);
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.playAll(sections);
    });

    // Complete the heading utterance to trigger 300ms delay
    act(() => {
      fireUtteranceEnd(0);
    });

    // Advance 100ms into the 300ms delay, then pause
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const countBeforePause = utterances.length;

    act(() => {
      result.current.pause();
    });

    // Advance a long time — nothing should happen while paused
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(utterances.length).toBe(countBeforePause);

    // Resume — remaining ~200ms should be scheduled
    act(() => {
      result.current.resume();
    });

    // Not yet (only ~200ms remaining)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(utterances.length).toBe(countBeforePause);

    // Now it should fire
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(utterances.length).toBeGreaterThan(countBeforePause);
  });
});

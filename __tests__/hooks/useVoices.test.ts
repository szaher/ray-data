import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoices } from "@/hooks/useVoices";

// ── Mock data ───────────────────────────────────────────────────

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: `${name}-${lang}`,
    localService: true,
    default: false,
  } as SpeechSynthesisVoice;
}

const VOICES = [
  makeVoice("Samantha", "en-US"),
  makeVoice("Alex", "en-US"),
  makeVoice("Thomas", "fr-FR"),
  makeVoice("Anna", "de-DE"),
];

// ── Mock speechSynthesis ────────────────────────────────────────

let voicesChangedListeners: Array<() => void> = [];

const mockSpeechSynthesis = {
  getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
  addEventListener: vi.fn((event: string, fn: () => void) => {
    if (event === "voiceschanged") {
      voicesChangedListeners.push(fn);
    }
  }),
  removeEventListener: vi.fn((event: string, fn: () => void) => {
    if (event === "voiceschanged") {
      voicesChangedListeners = voicesChangedListeners.filter((l) => l !== fn);
    }
  }),
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

// ── Mock localStorage ───────────────────────────────────────────

let storage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    storage = {};
  }),
  get length() {
    return Object.keys(storage).length;
  },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};

beforeEach(() => {
  storage = {};
  voicesChangedListeners = [];
  document.documentElement.lang = "en";
  mockSpeechSynthesis.getVoices.mockReturnValue([]);
  vi.stubGlobal("speechSynthesis", mockSpeechSynthesis);
  vi.stubGlobal("localStorage", mockLocalStorage);
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────

describe("useVoices", () => {
  it("loads voices from initial getVoices() filtered to content language", () => {
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());

    // 4 total voices, 2 English — filtered to en
    expect(result.current.voices.length).toBe(2);
  });

  it("updates voices on voiceschanged event", () => {
    mockSpeechSynthesis.getVoices.mockReturnValue([]);

    const { result } = renderHook(() => useVoices());
    expect(result.current.voices.length).toBe(0);

    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);
    act(() => {
      voicesChangedListeners.forEach((fn) => fn());
    });

    expect(result.current.voices.length).toBe(2);
  });

  it("filters voices to match content language", () => {
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());
    const names = result.current.voices.map((v) => v.voice.name);

    // Only en voices shown when document lang is "en"
    expect(names).toEqual(["Alex", "Samantha"]);
    expect(result.current.contentLang).toBe("en");
  });

  it("shows all matching voices for a different content language", () => {
    document.documentElement.lang = "fr";
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());
    const names = result.current.voices.map((v) => v.voice.name);

    expect(names).toEqual(["Thomas"]);
  });

  it("persists selected voice by voiceURI", () => {
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());

    act(() => {
      result.current.selectVoice("Samantha-en-US");
    });

    expect(result.current.selectedVoiceURI).toBe("Samantha-en-US");
    expect(result.current.selectedVoice?.name).toBe("Samantha");
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining("tts-voice"),
      "Samantha-en-US",
    );
  });

  it("restores persisted voice on mount", () => {
    storage["ray-data-tts-voice"] = "Alex-en-US";
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());

    expect(result.current.selectedVoiceURI).toBe("Alex-en-US");
    expect(result.current.selectedVoice?.name).toBe("Alex");
  });

  it("falls back to null for a stale persisted voice", () => {
    storage["ray-data-tts-voice"] = "NonExistent-xx-YY";
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());

    expect(result.current.selectedVoiceURI).toBe("NonExistent-xx-YY");
    expect(result.current.selectedVoice).toBeNull();
  });

  it("clears persisted voice when selecting empty string", () => {
    storage["ray-data-tts-voice"] = "Samantha-en-US";
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    const { result } = renderHook(() => useVoices());

    act(() => {
      result.current.selectVoice("");
    });

    expect(result.current.selectedVoiceURI).toBeNull();
    expect(result.current.selectedVoice).toBeNull();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
      expect.stringContaining("tts-voice"),
    );
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    mockSpeechSynthesis.getVoices.mockReturnValue(VOICES);

    expect(() => {
      const { result } = renderHook(() => useVoices());
      act(() => {
        result.current.selectVoice("Samantha-en-US");
      });
    }).not.toThrow();
  });
});

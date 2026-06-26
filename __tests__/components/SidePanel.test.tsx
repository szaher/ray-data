import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SidePanel from "@/components/SidePanel";

// ── Mock notes lib ──────────────────────────────────────────────

vi.mock("@/lib/notes", () => ({
  getLessonNote: vi.fn(() => ""),
  saveLessonNote: vi.fn(),
}));

// ── Helper ──────────────────────────────────────────────────────

function renderPanel(overrides: Partial<Parameters<typeof SidePanel>[0]> = {}) {
  const defaults = {
    isOpen: true,
    activeTab: "notes" as const,
    onTabChange: vi.fn(),
    onClose: vi.fn(),
    moduleId: 1,
    lessonSlug: "intro",
    onNoteChange: vi.fn(),
    voices: [] as SpeechSynthesisVoice[],
    selectedVoiceURI: null,
    onSelectVoice: vi.fn(),
    speed: 1,
    onCycleSpeed: vi.fn(),
    isPlaying: false,
    isSpeechSupported: true,
    contentLang: "en",
  };
  return render(<SidePanel {...defaults} {...overrides} />);
}

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: `${name}-${lang}`,
    localService: true,
    default: false,
  } as SpeechSynthesisVoice;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────

describe("SidePanel tab switching", () => {
  it("shows Notes tab content when activeTab is notes", () => {
    renderPanel({ activeTab: "notes" });
    expect(screen.getByPlaceholderText("Take notes on this lesson...")).toBeTruthy();
  });

  it("shows Voice tab content when activeTab is voice", () => {
    renderPanel({ activeTab: "voice" });
    expect(screen.getByLabelText("Narration voice")).toBeTruthy();
  });

  it("calls onTabChange when clicking a tab", () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: "notes", onTabChange });

    fireEvent.click(screen.getByRole("tab", { name: "Voice" }));
    expect(onTabChange).toHaveBeenCalledWith("voice");
  });

  it("marks the active tab with aria-selected", () => {
    renderPanel({ activeTab: "voice" });
    const voiceTab = screen.getByRole("tab", { name: "Voice" });
    const notesTab = screen.getByRole("tab", { name: "Notes" });
    expect(voiceTab.getAttribute("aria-selected")).toBe("true");
    expect(notesTab.getAttribute("aria-selected")).toBe("false");
  });
});

describe("SidePanel close behavior", () => {
  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the mobile backdrop", () => {
    const onClose = vi.fn();
    const { container } = renderPanel({ onClose });
    const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/50");
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});

describe("SidePanel notes tab", () => {
  it("calls onNoteChange when typing", () => {
    const onNoteChange = vi.fn();
    renderPanel({ activeTab: "notes", onNoteChange });
    const textarea = screen.getByPlaceholderText("Take notes on this lesson...");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(onNoteChange).toHaveBeenCalledWith(true);
  });
});

describe("SidePanel voice tab", () => {
  it("shows Default voice option", () => {
    renderPanel({ activeTab: "voice" });
    expect(screen.getByText("Default voice")).toBeTruthy();
  });

  it("renders voice options", () => {
    const voices = [makeVoice("Samantha", "en-US"), makeVoice("Alex", "en-US")];
    renderPanel({ activeTab: "voice", voices });
    expect(screen.getByText("Samantha (en-US)")).toBeTruthy();
    expect(screen.getByText("Alex (en-US)")).toBeTruthy();
  });

  it("disables voice select during playback", () => {
    renderPanel({ activeTab: "voice", isPlaying: true });
    const select = screen.getByLabelText("Narration voice");
    expect(select).toHaveProperty("disabled", true);
  });

  it("calls onSelectVoice when changing selection", () => {
    const onSelectVoice = vi.fn();
    const voices = [makeVoice("Samantha", "en-US")];
    renderPanel({ activeTab: "voice", voices, onSelectVoice });
    const select = screen.getByLabelText("Narration voice");
    fireEvent.change(select, { target: { value: "Samantha-en-US" } });
    expect(onSelectVoice).toHaveBeenCalledWith("Samantha-en-US");
  });

  it("shows unavailable message when speech is unsupported", () => {
    renderPanel({ activeTab: "voice", isSpeechSupported: false });
    expect(screen.getByText("Narration is unavailable in this browser.")).toBeTruthy();
  });

  it("calls onCycleSpeed when clicking speed button", () => {
    const onCycleSpeed = vi.fn();
    renderPanel({ activeTab: "voice", onCycleSpeed });
    fireEvent.click(screen.getByText("1x"));
    expect(onCycleSpeed).toHaveBeenCalledTimes(1);
  });
});

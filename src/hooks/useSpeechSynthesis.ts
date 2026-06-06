"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechSection } from "@/lib/speech";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const CHUNK_WORD_LIMIT = 150;

interface UseSpeechSynthesisOptions {
  onSectionChange?: (index: number) => void;
  onEnd?: () => void;
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_WORD_LIMIT) {
    chunks.push(words.slice(i, i + CHUNK_WORD_LIMIT).join(" "));
  }
  return chunks.filter((c) => c.trim().length > 0);
}

export function useSpeechSynthesis(options?: UseSpeechSynthesisOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [speed, setSpeed] = useState(1);

  const sectionsRef = useRef<SpeechSection[]>([]);
  const sectionQueueRef = useRef<number[]>([]);
  const abortRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const cancelSpeech = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    abortRef.current = true;
    sectionQueueRef.current = [];
    cancelSpeech();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSectionIndex(-1);
    options?.onEnd?.();
  }, [cancelSpeech, options]);

  const speakSection = useCallback(
    (section: SpeechSection, sectionIndex: number, onDone: () => void) => {
      const chunks = chunkText(section.heading + ". " + section.text);
      let chunkIndex = 0;

      setCurrentSectionIndex(sectionIndex);
      options?.onSectionChange?.(sectionIndex);

      function speakNextChunk() {
        if (abortRef.current || chunkIndex >= chunks.length) {
          onDone();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
        utterance.rate = speed;
        utterance.onend = () => {
          chunkIndex++;
          speakNextChunk();
        };
        utterance.onerror = (e) => {
          if (e.error !== "canceled") {
            chunkIndex++;
            speakNextChunk();
          }
        };
        window.speechSynthesis.speak(utterance);
      }

      speakNextChunk();
    },
    [speed, options]
  );

  const advanceQueue = useCallback(() => {
    if (abortRef.current) return;

    const nextIndex = sectionQueueRef.current.shift();
    if (nextIndex === undefined) {
      setIsPlaying(false);
      setCurrentSectionIndex(-1);
      options?.onEnd?.();
      return;
    }

    const section = sectionsRef.current[nextIndex];
    if (!section) return;

    speakSection(section, nextIndex, () => {
      advanceQueue();
    });
  }, [speakSection, options]);

  const playAll = useCallback(
    (sections: SpeechSection[]) => {
      if (!isSupported || sections.length === 0) return;
      cancelSpeech();
      abortRef.current = false;
      sectionsRef.current = sections;
      sectionQueueRef.current = sections.map((_, i) => i);
      setIsPlaying(true);
      setIsPaused(false);
      advanceQueue();
    },
    [isSupported, cancelSpeech, advanceQueue]
  );

  const playSection = useCallback(
    (sections: SpeechSection[], index: number) => {
      if (!isSupported || !sections[index]) return;
      cancelSpeech();
      abortRef.current = false;
      sectionsRef.current = sections;
      sectionQueueRef.current = [];
      setIsPlaying(true);
      setIsPaused(false);
      speakSection(sections[index], index, () => {
        setIsPlaying(false);
        setCurrentSectionIndex(-1);
        options?.onEnd?.();
      });
    },
    [isSupported, cancelSpeech, speakSection, options]
  );

  const pause = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSupported]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev as (typeof SPEEDS)[number]);
      return SPEEDS[(idx + 1) % SPEEDS.length];
    });
  }, []);

  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isPlaying,
    isPaused,
    currentSectionIndex,
    speed,
    isSupported,
    playAll,
    playSection,
    pause,
    resume,
    stop,
    cycleSpeed,
  };
}

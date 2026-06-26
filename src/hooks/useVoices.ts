"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { storageKeys } from "../../academy.config";

export interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
  langGroup: string;
}

function readStoredVoice(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(storageKeys.ttsVoice);
  } catch {
    return null;
  }
}

function writeStoredVoice(voiceURI: string | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (voiceURI) {
      localStorage.setItem(storageKeys.ttsVoice, voiceURI);
    } else {
      localStorage.removeItem(storageKeys.ttsVoice);
    }
  } catch {
    // localStorage unavailable or full — silently degrade
  }
}

const noopSubscribe = () => () => {};

function getContentLang(): string {
  return document.documentElement.lang?.split("-")[0]?.toLowerCase() || "en";
}

function getServerLang(): string {
  return "en";
}

export function useVoices() {
  const [allVoices, setAllVoices] = useState<VoiceInfo[]>([]);
  const contentLang = useSyncExternalStore(noopSubscribe, getContentLang, getServerLang);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(
    readStoredVoice,
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    )
      return;

    function loadVoices() {
      const raw = window.speechSynthesis.getVoices();
      const mapped: VoiceInfo[] = raw.map((v) => ({
        voice: v,
        label: `${v.name} (${v.lang})`,
        langGroup: v.lang.split("-")[0].toLowerCase(),
      }));
      mapped.sort((a, b) => {
        const langCmp = a.langGroup.localeCompare(b.langGroup);
        if (langCmp !== 0) return langCmp;
        return a.voice.name.localeCompare(b.voice.name);
      });
      setAllVoices(mapped);
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    let retries = 0;
    const retryTimer = setInterval(() => {
      retries++;
      const current = window.speechSynthesis.getVoices();
      if (current.length > 0 || retries >= 5) {
        if (current.length > 0) loadVoices();
        clearInterval(retryTimer);
      }
    }, 200);

    return () => {
      clearInterval(retryTimer);
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices,
      );
    };
  }, []);

  const voices = allVoices.filter((v) => v.langGroup === contentLang);

  const selectedVoice: SpeechSynthesisVoice | null =
    voices.find((v) => v.voice.voiceURI === selectedVoiceURI)?.voice ??
    null;

  const selectVoice = useCallback((voiceURI: string) => {
    const uri = voiceURI || null;
    setSelectedVoiceURI(uri);
    writeStoredVoice(uri);
  }, []);

  return { voices, selectedVoice, selectedVoiceURI, selectVoice, contentLang };
}

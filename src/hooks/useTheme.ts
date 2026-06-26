"use client";

import { useCallback, useEffect, useState } from "react";
import { storageKeys } from "../../academy.config";

type ThemeMode = "system" | "light" | "dark";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof localStorage === "undefined") return "system";
    return (localStorage.getItem(storageKeys.theme) as ThemeMode | null) || "system";
  });

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((prev) => {
      const order: ThemeMode[] = ["system", "light", "dark"];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      localStorage.setItem(storageKeys.theme, next);
      applyTheme(next);
      return next;
    });
  }, []);

  return { mode, cycle };
}

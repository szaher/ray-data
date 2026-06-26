"use client";

import { useEffect, useRef, useState } from "react";

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleExport = async (scope: "all" | number, format: string) => {
    setExporting(true);
    setStatus("Starting export...");
    setOpen(false);

    try {
      const body: Record<string, unknown> = { format };
      if (scope !== "all") body.module = scope;

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) throw new Error("Export failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setStatus(data.message.trim());
              if (data.status === "done") setStatus("Export complete!");
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setExporting(false);
      setTimeout(() => setStatus(""), 5000);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        disabled={exporting}
      >
        {exporting ? "Exporting..." : "Export"}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-xl z-50">
          <div className="py-1">
            <button onClick={() => handleExport("all", "both")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (MD + Notebook)
            </button>
            <button onClick={() => handleExport("all", "markdown")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (Markdown only)
            </button>
            <button onClick={() => handleExport("all", "notebook")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (Notebooks only)
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="absolute right-0 mt-2 w-64 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] z-50">
          {status}
        </div>
      )}
    </div>
  );
}

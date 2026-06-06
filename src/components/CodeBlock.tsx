"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({ code, language = "python", filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lineCount = code.split("\n").length;
  const height = Math.min(Math.max(lineCount * 20 + 20, 80), 500);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl border border-white/[0.08] overflow-hidden bg-[var(--bg-tertiary)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08]">
        <span className="text-xs text-[var(--text-secondary)]">
          {filename || language}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Editor
        height={height}
        language={language}
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          folding: false,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: { vertical: "hidden", horizontal: "auto" },
        }}
      />
    </div>
  );
}

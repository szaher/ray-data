"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeBlockProps {
  code?: string;
  language?: string;
  filename?: string;
  children?: React.ReactNode;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

export default function CodeBlock({ code, language = "python", filename, children }: CodeBlockProps) {
  const codeText = code || extractText(children) || "";
  const [copied, setCopied] = useState(false);
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "vs">(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light" ? "vs" : "vs-dark"
  );

  useEffect(() => {
    const resolve = () =>
      setEditorTheme(document.documentElement.getAttribute("data-theme") === "light" ? "vs" : "vs-dark");
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const lineCount = codeText.split("\n").length;
  const height = Math.min(Math.max(lineCount * 20 + 20, 80), 500);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-tertiary)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
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
        value={codeText}
        theme={editorTheme}
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

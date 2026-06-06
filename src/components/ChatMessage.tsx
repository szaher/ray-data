"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidDiagram from "./MermaidDiagram";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const parts = parseContent(content);

  return (
    <div className={`py-4 ${role === "user" ? "pl-12" : "pr-12"}`}>
      <div className="text-xs text-[var(--text-secondary)] mb-1.5">
        {role === "user" ? "You" : "Claude"}
      </div>
      <div
        className={`rounded-xl px-4 py-3 ${
          role === "user"
            ? "bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20"
            : "bg-[var(--bg-secondary)] border border-[var(--border)]"
        }`}
      >
        {parts.map((part, i) => {
          if (part.type === "mermaid") {
            return <MermaidDiagram key={i} chart={part.content} />;
          }
          if (part.type === "code") {
            return (
              <pre
                key={i}
                className="my-3 p-3 bg-[var(--bg-tertiary)] rounded-lg text-sm overflow-x-auto"
              >
                <code>{part.content}</code>
              </pre>
            );
          }
          return (
            <div key={i} className="chat-markdown text-sm leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{part.content}</Markdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ContentPart {
  type: "text" | "mermaid" | "code";
  content: string;
  language?: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", content: text });
    }

    const language = match[1];
    const code = match[2].trim();

    if (language === "mermaid") {
      parts.push({ type: "mermaid", content: code });
    } else {
      parts.push({ type: "code", content: code, language });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", content: text });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content });
  }

  return parts;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/types";
import ChatMessage from "./ChatMessage";

interface ChatInterfaceProps {
  initialContext?: {
    moduleTitle?: string;
    lessonTitle?: string;
  };
}

const STORAGE_KEY = "ray-data-academy-chat";

function loadHistory(): ChatMessageType[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory(messages: ChatMessageType[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export default function ChatInterface({ initialContext }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      const updated = [...messages, userMsg, assistantMsg];
      setMessages(updated);
      setInput("");
      setStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            context: {
              ...initialContext,
              history: messages.slice(-10),
            },
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Chat request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const chunk = JSON.parse(data);
                fullContent += chunk;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    ...copy[copy.length - 1],
                    content: fullContent,
                  };
                  return copy;
                });
              } catch {
                // skip malformed chunks
              }
            }
          }
        }

        setMessages((prev) => {
          saveHistory(prev);
          return prev;
        });
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, initialContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <div className="text-center">
              <p className="text-lg mb-2">Ask anything about Ray Data</p>
              <p className="text-sm">I'll explain with diagrams and code examples</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-xl border border-white/[0.08] px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about Ray Data..."
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
            disabled={streaming}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent-blue)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

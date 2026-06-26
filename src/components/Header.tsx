"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ExportMenu from "./ExportMenu";
import ThemeToggle from "./ThemeToggle";
import { academy } from "../../academy.config";

export default function Header() {
  const pathname = usePathname();
  const isChat = pathname.startsWith("/chat");
  const isLesson = pathname.startsWith("/lesson") || pathname === "/";

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <Link href="/" className="flex items-center gap-2 text-[var(--accent-blue)] font-semibold text-lg">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: academy.accentColor }} />
        {academy.name}
      </Link>

      <nav className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
        <Link
          href="/"
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            isLesson
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Lesson Mode
        </Link>
        <Link
          href="/chat"
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            isChat
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Chat Mode
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <ExportMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
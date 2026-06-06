"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ExportMenu from "./ExportMenu";

export default function Header() {
  const pathname = usePathname();
  const isChat = pathname.startsWith("/chat");
  const isLesson = pathname.startsWith("/lesson") || pathname === "/";

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.08] bg-[var(--bg-secondary)]">
      <Link href="/" className="flex items-center gap-2 text-[var(--accent-blue)] font-semibold text-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-blue)]" />
        Ray Data Academy
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
        <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
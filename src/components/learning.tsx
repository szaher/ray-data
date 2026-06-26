import type { ReactNode } from "react";
import MermaidDiagram from "./MermaidDiagram";

type Tone = "info" | "success" | "warning" | "danger" | "verify";
type SourceQuality = "primary" | "official-docs" | "peer-reviewed" | "expert" | "secondary" | "unverified";

const toneClasses: Record<Tone, string> = {
  info: "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10",
  success: "border-[var(--accent-green)] bg-[var(--accent-green)]/10",
  warning: "border-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10",
  danger: "border-[var(--accent-red)] bg-[var(--accent-red)]/10",
  verify: "border-[var(--accent-purple)] bg-[var(--accent-purple)]/10",
};

const qualityLabels: Record<SourceQuality, string> = {
  primary: "Primary source",
  "official-docs": "Official docs",
  "peer-reviewed": "Peer reviewed",
  expert: "Expert source",
  secondary: "Secondary source",
  unverified: "Unverified",
};

function Panel({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <section className={`my-5 rounded-lg border p-4 ${toneClasses[tone]}`}>
      {title && <h3 className="mt-0 text-base font-semibold">{title}</h3>}
      <div className="space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

export function LearningObjectives({ items }: { items: string[] }) {
  return (
    <Panel title="Learning Objectives" tone="success">
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Panel>
  );
}

export function Prerequisites({ items }: { items: string[] }) {
  return (
    <Panel title="Prerequisites">
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Panel>
  );
}

export function KeyTerms({ terms }: { terms: { term: string; definition: string }[] }) {
  return (
    <Panel title="Key Terms">
      <dl className="grid gap-3">
        {terms.map((item) => (
          <div key={item.term}>
            <dt className="font-semibold">{item.term}</dt>
            <dd className="m-0 text-[var(--text-secondary)]">{item.definition}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function Callout({
  title,
  tone = "info",
  children,
}: {
  title?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <Panel title={title} tone={tone}>
      {children}
    </Panel>
  );
}

export function Warning({ title = "Warning", children }: { title?: string; children: ReactNode }) {
  return (
    <Panel title={title} tone="warning">
      {children}
    </Panel>
  );
}

export function Diagram({
  chart,
  fallback,
  caption,
}: {
  chart: string;
  fallback?: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      <MermaidDiagram chart={chart} fallback={fallback} />
      {caption && <figcaption className="mt-2 text-center text-xs text-[var(--text-secondary)]">{caption}</figcaption>}
    </figure>
  );
}

export function Flashcards({
  cards,
}: {
  cards: { front: string; back: string }[];
}) {
  return (
    <div className="my-6 grid gap-3">
      {cards.map((card) => (
        <details key={card.front} className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
          <summary className="cursor-pointer font-semibold">{card.front}</summary>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{card.back}</p>
        </details>
      ))}
    </div>
  );
}

export function QuizBlock({
  questions,
}: {
  questions: { prompt: string; answer: string; choices?: string[] }[];
}) {
  return (
    <div className="my-6 space-y-4">
      {questions.map((question) => (
        <details key={question.prompt} className="rounded-lg border border-[var(--border)] p-4">
          <summary className="cursor-pointer font-semibold">{question.prompt}</summary>
          {question.choices && (
            <ul className="mt-3">
              {question.choices.map((choice) => (
                <li key={choice}>{choice}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{question.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function WorkedExample({
  title,
  steps,
  children,
}: {
  title: string;
  steps?: string[];
  children: ReactNode;
}) {
  return (
    <Panel title={title} tone="success">
      {children}
      {steps && (
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function Exercise({
  title,
  answer,
  children,
}: {
  title: string;
  answer?: string;
  children: ReactNode;
}) {
  return (
    <Panel title={title}>
      {children}
      {answer && (
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold">Answer</summary>
          <p className="text-[var(--text-secondary)]">{answer}</p>
        </details>
      )}
    </Panel>
  );
}

export function DataTable({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
      {caption && <figcaption className="mt-2 text-xs text-[var(--text-secondary)]">{caption}</figcaption>}
    </figure>
  );
}

export function NarrationHook({
  id,
  script,
  voice = "default",
}: {
  id: string;
  script: string;
  voice?: string;
}) {
  return <span data-narration-id={id} data-voice={voice} data-script={script} className="sr-only" />;
}

export function MindMap({
  root,
  branches,
}: {
  root: string;
  branches: { label: string; children?: string[] }[];
}) {
  return (
    <Panel title={root}>
      <ul>
        {branches.map((branch) => (
          <li key={branch.label}>
            <strong>{branch.label}</strong>
            {branch.children && (
              <ul>
                {branch.children.map((child) => (
                  <li key={child}>{child}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function Infographic({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full rounded-lg border border-[var(--border)]" />
      {caption && <figcaption className="mt-2 text-center text-xs text-[var(--text-secondary)]">{caption}</figcaption>}
    </figure>
  );
}

export function SlideEmbed({
  src,
  title,
  fallbackHref,
}: {
  src: string;
  title: string;
  fallbackHref?: string;
}) {
  return (
    <figure className="my-6">
      <iframe src={src} title={title} className="aspect-video w-full rounded-lg border border-[var(--border)]" />
      {fallbackHref && (
        <figcaption className="mt-2 text-xs">
          <a href={fallbackHref}>Open slides</a>
        </figcaption>
      )}
    </figure>
  );
}

export function Citation({
  id,
  href,
  quality,
  children,
}: {
  id: string;
  href: string;
  quality: SourceQuality;
  children: ReactNode;
}) {
  return (
    <a href={href} data-citation-id={id} data-source-quality={quality} className="citation">
      {children}
      <span className="ml-1 text-xs text-[var(--text-secondary)]">[{qualityLabels[quality]}]</span>
    </a>
  );
}

export function SourceQualityLabel({ quality }: { quality: SourceQuality }) {
  return (
    <span data-source-quality={quality} className="rounded border border-[var(--border)] px-2 py-0.5 text-xs">
      {qualityLabels[quality]}
    </span>
  );
}

export function VerifyClaim({
  status = "verify",
  children,
}: {
  status?: "verified" | "verify" | "unsupported";
  children: ReactNode;
}) {
  const tone = status === "verified" ? "success" : status === "unsupported" ? "danger" : "verify";
  return (
    <Panel title={`Claim status: ${status}`} tone={tone}>
      <span data-claim-status={status}>{children}</span>
    </Panel>
  );
}

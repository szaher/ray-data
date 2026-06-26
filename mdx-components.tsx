import type { MDXComponents } from "mdx/types";
import MermaidDiagram from "@/components/MermaidDiagram";
import CodeBlock from "@/components/CodeBlock";
import {
  Callout,
  Citation,
  DataTable,
  Diagram,
  Exercise,
  Flashcards,
  Infographic,
  KeyTerms,
  LearningObjectives,
  MindMap,
  NarrationHook,
  Prerequisites,
  QuizBlock,
  SlideEmbed,
  SourceQualityLabel,
  VerifyClaim,
  Warning,
  WorkedExample,
} from "@/components/learning";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    MermaidDiagram,
    CodeBlock,
    Callout,
    Citation,
    DataTable,
    Diagram,
    Exercise,
    Flashcards,
    Infographic,
    KeyTerms,
    LearningObjectives,
    MindMap,
    NarrationHook,
    Prerequisites,
    QuizBlock,
    SlideEmbed,
    SourceQualityLabel,
    VerifyClaim,
    Warning,
    WorkedExample,
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) => {
      return <pre {...props}>{children}</pre>;
    },
  };
}

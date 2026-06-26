import { MDXRemote as BaseMDXRemote } from "next-mdx-remote/rsc";
import MermaidDiagram from "./MermaidDiagram";
import CodeBlock from "./CodeBlock";
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
} from "./learning";

const components = {
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
};

interface MDXRemoteProps {
  source: string;
}

export function MDXRemote({ source }: MDXRemoteProps) {
  return (
    <BaseMDXRemote
      source={source}
      components={components}
      options={{ blockJS: false }}
    />
  );
}

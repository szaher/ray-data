import { MDXRemote as BaseMDXRemote } from "next-mdx-remote/rsc";
import MermaidDiagram from "./MermaidDiagram";
import CodeBlock from "./CodeBlock";

const components = {
  MermaidDiagram,
  CodeBlock,
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

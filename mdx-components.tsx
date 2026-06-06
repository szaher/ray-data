import type { MDXComponents } from "mdx/types";
import MermaidDiagram from "@/components/MermaidDiagram";
import CodeBlock from "@/components/CodeBlock";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    MermaidDiagram,
    CodeBlock,
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) => {
      return <pre {...props}>{children}</pre>;
    },
  };
}

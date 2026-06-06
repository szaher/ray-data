import matter from "gray-matter";

export interface ParsedLesson {
  frontmatter: Record<string, unknown>;
  content: string;
}

export function parseMDX(raw: string): ParsedLesson {
  const { data, content } = matter(raw);
  return { frontmatter: data, content };
}

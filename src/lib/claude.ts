import { spawn } from "child_process";
import type { ChatMessage } from "@/types";

interface PromptContext {
  moduleTitle?: string;
  lessonTitle?: string;
  history?: ChatMessage[];
}

export function buildSystemPrompt(context?: PromptContext): string {
  let prompt = `You are an expert Ray Data tutor. You teach distributed computing concepts using Ray (version 2.55.1).

Your role:
- Explain concepts clearly with visual diagrams and code examples
- Use \`\`\`mermaid code blocks for architecture diagrams, flowcharts, and sequence diagrams
- Use \`\`\`python code blocks with Ray 2.55.1 APIs for code examples
- Break complex topics into digestible pieces
- Use analogies to connect new concepts to familiar ones
- Be encouraging and patient — the student is a complete beginner

When generating diagrams, always use mermaid syntax. For example:
\`\`\`mermaid
graph TD
    A[Input Data] --> B[Ray Dataset]
    B --> C[Transform]
    C --> D[Output]
\`\`\`

Always use Ray 2.55.1 APIs. Key imports: ray, ray.data. The Dataset class is the core abstraction.`;

  if (context?.moduleTitle) {
    prompt += `\n\nThe student is currently studying: Module "${context.moduleTitle}"`;
    if (context.lessonTitle) {
      prompt += `, Lesson "${context.lessonTitle}"`;
    }
    prompt += ". Tailor your answers to this context.";
  }

  if (context?.history && context.history.length > 0) {
    const recent = context.history.slice(-10);
    prompt += "\n\nRecent conversation history:\n";
    for (const msg of recent) {
      prompt += `${msg.role === "user" ? "Student" : "Tutor"}: ${msg.content}\n`;
    }
  }

  return prompt;
}

export function streamClaude(
  userMessage: string,
  context?: PromptContext
): { stream: AsyncIterable<string>; kill: () => void } {
  const systemPrompt = buildSystemPrompt(context);

  const proc = spawn(
    "claude",
    ["--print", "--output-format", "text", "-p", userMessage],
    {
      shell: true,
      env: {
        ...process.env,
        CLAUDE_SYSTEM_PROMPT: systemPrompt,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const stream = (async function* () {
    if (!proc.stdout) return;

    for await (const chunk of proc.stdout) {
      yield chunk.toString();
    }
  })();

  return {
    stream,
    kill: () => proc.kill(),
  };
}

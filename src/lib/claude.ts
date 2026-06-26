import AnthropicVertex from "@anthropic-ai/vertex-sdk";
import type { ChatMessage } from "@/types";
import { academy } from "../../academy.config";

interface PromptContext {
  moduleTitle?: string;
  lessonTitle?: string;
  history?: ChatMessage[];
}

export function buildSystemPrompt(context?: PromptContext): string {
  let prompt = academy.tutor.systemPrompt;

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

let _client: AnthropicVertex | null = null;

function getClient(): AnthropicVertex {
  if (!_client) {
    _client = new AnthropicVertex({
      projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID || "your-gcp-project",
      region: process.env.CLOUD_ML_REGION || "us-east5",
    });
  }
  return _client;
}

export function streamClaude(
  userMessage: string,
  context?: PromptContext
): { stream: AsyncIterable<string>; kill: () => void } {
  const systemPrompt = buildSystemPrompt(context);
  let aborted = false;

  const stream = (async function* () {
    const response = await getClient().messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of response) {
      if (aborted) break;
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  })();

  return {
    stream,
    kill: () => {
      aborted = true;
    },
  };
}

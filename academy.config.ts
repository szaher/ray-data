export const academy = {
  name: "Ray Data Academy",
  slug: "ray-data",
  description: "Master distributed data processing with Ray Data",
  tagline: "Master Ray Data from the ground up",

  tutor: {
    systemPrompt: `You are an expert Ray Data tutor. You teach distributed computing concepts using Ray (version 2.55.1).

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

Always use Ray 2.55.1 APIs. Key imports: ray, ray.data. The Dataset class is the core abstraction.`,
    codeLanguage: "python",
    chatPlaceholder: "Ask about Ray Data...",
    chatWelcome: "Ask anything about Ray Data",
    chatSubtext: "I'll explain with diagrams and code examples",
  },

  accentColor: "#63b3ed",

  moduleColors: [
    "#68d391", "#4fd1c5", "#63b3ed", "#b794f4",
    "#ed8936", "#fc8181", "#ecc94b", "#68d391",
    "#4fd1c5", "#63b3ed", "#b794f4", "#ed8936",
    "#fc8181",
  ],

  presentation: {
    theme: "academy",
    header: "Ray Data Academy",
  },
} as const;

export const storageKeys = {
  progress: `${academy.slug}-progress`,
  notes: `${academy.slug}-notes`,
  chat: `${academy.slug}-chat`,
  theme: `${academy.slug}-theme`,
  ttsVoice: `${academy.slug}-tts-voice`,
} as const;

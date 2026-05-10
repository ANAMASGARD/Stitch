import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export type RagChunkLike = { content?: string; path?: string };

/** Turn Pinecone-style chunks into a single block for the review prompt. */
export function formatRagContextForReview(chunks: RagChunkLike[]): string {
  if (!chunks.length) return "";
  return chunks
    .filter((c) => c.content)
    .map((c) => (c.path ? `[${c.path}]\n${c.content}` : String(c.content)))
    .join("\n\n");
}

export type GeneratePrReviewMarkdownInput = {
  title: string;
  description: string;
  diff: string;
  /** Pre-formatted RAG text (use {@link formatRagContextForReview}). */
  contextFromCodebase: string;
  /**
   * Optional GitHub-native context (changed files list, reviews, inline
   * comments, issue thread). Empty string skips the block in the prompt.
   */
  githubThreadContext?: string;
  extraInstructions?: string;
};

/**
 * Same markdown review contract as the Inngest PR review job: walkthrough,
 * Mermaid sequence diagram, summary, strengths, issues, suggestions, poem.
 */
export async function generatePrReviewMarkdown(
  input: GeneratePrReviewMarkdownInput
): Promise<string> {
  const {
    title,
    description,
    diff,
    contextFromCodebase,
    githubThreadContext,
    extraInstructions,
  } = input;

  const contextBlock =
    contextFromCodebase.trim() ||
    "(No indexed codebase context provided.)";

  const ghThread =
    (githubThreadContext ?? "").trim() ||
    "(No GitHub thread / review metadata provided.)";

  const extraTail = extraInstructions?.trim();
  const extra = extraTail
    ? `\n\nAdditional instructions:\n${extraTail}`
    : "";

  const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed, constructive code review.

PR Title: ${title}
PR Description: ${description || "No description provided"}

GitHub PR metadata and discussion (use together with the diff; cite specific threads when relevant):
${ghThread}

Context from Codebase:
${contextBlock}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Please provide:
1. **Walkthrough**: A file-by-file explanation of the changes.
2. **Sequence Diagram**: A Mermaid JS sequence diagram visualizing the flow of the changes (if applicable). Use \`\`\`mermaid ... \`\`\` block. **IMPORTANT**: Ensure the Mermaid syntax is valid. Do not use special characters (like quotes, braces, parentheses) inside Note text or labels as it breaks rendering. Keep the diagram simple.
3. **Summary**: Brief overview.
4. **Strengths**: What's done well.
5. **Issues**: Bugs, security concerns, code smells.
6. **Suggestions**: Specific code improvements.
7. **Poem**: A short, creative poem summarizing the changes at the very end.

Format your response in markdown.${extra}`;

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  try {
    const { text } = await generateText({
      model: openrouter("qwen/qwen3.5-flash-02-23"),
      prompt,
    });
    return text;
  } catch {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    return text;
  }
}

/**
 * When callers send a free-text prompt instead of a PR URL / diff bundle.
 */
export async function generateFreeformReviewMarkdown(
  userText: string,
  extraInstructions?: string
): Promise<string> {
  const extraTail = extraInstructions?.trim();
  const extra = extraTail
    ? `\n\nAdditional instructions:\n${extraTail}`
    : "";

  const prompt = `You are an expert software engineer and reviewer. Respond to the following with clear, actionable markdown (sections, bullet points as appropriate). If the user asks for a code review but did not supply a diff, explain what you would need (e.g. a GitHub PR URL or a patch) and still give general guidance based on the text.

User message:
${userText}${extra}`;

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  try {
    const { text } = await generateText({
      model: openrouter("qwen/qwen3.5-flash-02-23"),
      prompt,
    });
    return text;
  } catch {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    return text;
  }
}

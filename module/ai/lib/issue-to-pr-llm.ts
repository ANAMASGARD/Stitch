import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import type { RagChunkLike } from "@/module/ai/lib/pr-review-llm";

export const MAX_AUTO_PR_FILES = 5;
export const MAX_AUTO_PR_FILE_CHARS = 80_000;

export function formatIssueRagContext(chunks: RagChunkLike[]): string {
  if (!chunks.length) return "";
  return chunks
    .filter((c) => c.content)
    .map((c) => (c.path ? `[${c.path}]\n${c.content}` : String(c.content)))
    .join("\n\n");
}

/** Paths Stitch must not auto-edit (align with indexing / safety defaults). */
export function isPathBlockedForIssueAutomation(path: string): boolean {
  const p = path.trim().replace(/\\/g, "/");
  if (!p || p.includes("..")) return true;
  if (/^\.env$/i.test(p) || /\.env\./i.test(p)) return true;
  if (/node_modules\//i.test(p)) return true;
  if (/lib\/generated\/prisma/i.test(p)) return true;
  if (
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock)$/i.test(
      p
    )
  ) {
    return true;
  }
  if (/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|wasm|bin|lock)$/i.test(p)) {
    return true;
  }
  return false;
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

async function generateTextWithFallback(prompt: string): Promise<string> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  try {
    const { text } = await generateText({
      model: openrouter("google/gemma-4-31b-it:free"),
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

const issueTriageSchema = z.object({
  commentMarkdown: z.string().min(1),
  classification: z.enum(["genuine", "needs_info", "not_relevant", "unknown"]),
  likelyRelatedPaths: z.array(z.string()).max(12).optional(),
});

export type IssueTriageResult = z.infer<typeof issueTriageSchema>;

export async function analyzeIssueAgainstCodebase(input: {
  title: string;
  body: string;
  contextFromCodebase: string;
}): Promise<IssueTriageResult> {
  const { title, body, contextFromCodebase } = input;
  const prompt = `You triage GitHub issues against indexed repository context.

Issue title:
${title}

Issue body:
${body || "(empty)"}

Indexed codebase context (snippets; paths may be partial):
${contextFromCodebase || "(none)"}

Respond with a single JSON object ONLY (no markdown fences), shape:
{
  "commentMarkdown": string,  // short markdown for a public GitHub issue comment: 1–3 bullets max, no hype
  "classification": "genuine" | "needs_info" | "not_relevant" | "unknown",
  "likelyRelatedPaths": string[]  // optional; repo-relative file paths that seem relevant, only from context
}`;

  const raw = await generateTextWithFallback(prompt);
  return parseJsonWithZodRepair(raw, issueTriageSchema, "issue triage");
}

const planFileEntrySchema = z.object({
  path: z.string(),
  action: z.enum(["create", "modify", "delete"]),
  changeDescription: z.string(),
});

const issueFixPlanSchema = z.object({
  summary: z.string(),
  approach: z.string(),
  files: z.array(planFileEntrySchema).max(MAX_AUTO_PR_FILES),
});

export type IssueFixPlan = z.infer<typeof issueFixPlanSchema>;

export async function planIssueFix(input: {
  issueTitle: string;
  issueBody: string;
  contextFromCodebase: string;
  fileContents: Array<{ path: string; content: string }>;
  previousAnalysis?: string;
}): Promise<IssueFixPlan> {
  const filesBlock = input.fileContents
    .map(
      (f) =>
        `### ${f.path}\n\`\`\`\n${f.content.slice(0, MAX_AUTO_PR_FILE_CHARS)}\n\`\`\``
    )
    .join("\n\n");

  const prev = input.previousAnalysis?.trim()
    ? `Prior triage note:\n${input.previousAnalysis}\n\n`
    : "";

  const prompt = `You are planning a minimal code change to address a GitHub issue.

${prev}Issue title:
${input.issueTitle}

Issue body:
${input.issueBody || "(empty)"}

RAG context:
${input.contextFromCodebase || "(none)"}

Candidate file contents (truncated per file):
${filesBlock || "(no files loaded)"}

Return JSON ONLY (no markdown fences), shape:
{
  "summary": string,
  "approach": string,
  "files": [
    { "path": string, "action": "create" | "modify" | "delete", "changeDescription": string }
  ]
}

Rules:
- At most ${MAX_AUTO_PR_FILES} files.
- Only use paths that exist in file contents for modify/delete, or new logical paths under the repo for create.
- Do not include lockfiles, .env, binaries, or node_modules paths.`;

  const raw = await generateTextWithFallback(prompt);
  return parseJsonWithZodRepair(raw, issueFixPlanSchema, "issue fix plan");
}

export async function generateIssueFileContent(input: {
  path: string;
  currentContent: string | null;
  action: "create" | "modify";
  changeDescription: string;
  issueTitle: string;
  issueBody: string;
}): Promise<string> {
  const { path, currentContent, action, changeDescription, issueTitle, issueBody } =
    input;

  const prompt = `You output the FULL raw file contents for a single file change. No markdown fences. No explanation before or after the file.

Issue: ${issueTitle}
Description: ${issueBody || "(none)"}

File path: ${path}
Action: ${action}
Change requested: ${changeDescription}

${
  action === "modify" && currentContent != null
    ? `Current file:\n\`\`\`\n${currentContent.slice(0, MAX_AUTO_PR_FILE_CHARS)}\n\`\`\`\n\n`
    : ""
}Return ONLY the complete new file text (UTF-8).`;

  const text = (await generateTextWithFallback(prompt)).trim();
  const cleaned = stripJsonFences(text);
  if (cleaned.length > MAX_AUTO_PR_FILE_CHARS) {
    throw new Error(`Generated file exceeds ${MAX_AUTO_PR_FILE_CHARS} characters`);
  }
  return cleaned;
}

async function parseJsonWithZodRepair<T extends z.ZodTypeAny>(
  raw: string,
  schema: T,
  label: string
): Promise<z.infer<T>> {
  const firstTry = tryParseJson(raw, schema);
  if (firstTry.success) {
    return firstOk(firstTry);
  }

  const repairPrompt = `The following text was supposed to be JSON for: ${label}.
Validation error: ${firstTry.error}

Fix it and respond with JSON ONLY (no markdown fences), same schema.

Broken text:
${stripJsonFences(raw).slice(0, 12000)}`;

  const repaired = await generateTextWithFallback(repairPrompt);
  const second = tryParseJson(repaired, schema);
  if (second.success) {
    return firstOk(second);
  }

  throw new Error(
    `${label}: invalid JSON after repair (${second.error})`
  );
}

function tryParseJson<T extends z.ZodTypeAny>(
  raw: string,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const stripped = stripJsonFences(raw);
    const parsed: unknown = JSON.parse(stripped);
    const data = schema.safeParse(parsed);
    if (data.success) {
      return { success: true, data: data.data };
    }
    return { success: false, error: data.error.message };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "parse error",
    };
  }
}

function firstOk<T>(r: { success: true; data: T }): T {
  return r.data;
}

/**
 * Parse persisted `AutoPullRequest.planJson` from the DB.
 * Returns null if missing, invalid JSON, or does not match the stored fix-plan shape.
 */
export function parseStoredStitchIssueFixPlan(
  planJson: string | null | undefined
): IssueFixPlan | null {
  if (!planJson?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(planJson);
    const result = issueFixPlanSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

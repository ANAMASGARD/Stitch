/**
 * Request + response schemas for codereview (Zynd `payloadModel` / `outputModel`).
 * Published at `/.well-known/agent.json` as `input_schema` / `output_schema`.
 */

import { z } from "zod";

/**
 * Attachment schema — matches the Python SDK's Attachment model.
 */
export const Attachment = z.object({
  filename: z.string(),
  mime_type: z.string(),
  data: z.string(),
});

/**
 * Inbound request: one of
 * - `github_url` — public GitHub PR URL (fetched with server-side `GITHUB_READ_TOKEN`).
 *   You may add `prompt`/`content` and/or `extra_instructions` — both are merged into the review as user focus.
 * - `title` + `diff` — manual test bundle (`description` optional); `prompt`/`content` / `extra_instructions` also merge in.
 * - `prompt` or `content` alone — freeform (or JSON string with `github_url` inside for wire compatibility)
 *
 * Extra keys from the Zynd runtime (e.g. `sender_id`) are allowed via `.passthrough()`.
 */
export const RequestPayload = z
  .object({
    github_url: z.string().optional(),
    extra_instructions: z.string().optional(),
    use_rag: z.boolean().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    diff: z.string().optional(),
    prompt: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const gh = data.github_url?.trim();
    const title = data.title?.trim();
    const diff = data.diff?.trim();
    const prompt = data.prompt?.trim();
    const content = data.content?.trim();
    const hasGithub = Boolean(gh);
    const hasTitleDiff = Boolean(title && diff);
    const hasPrompt = Boolean(prompt || content);
    if (!hasGithub && !hasTitleDiff && !hasPrompt) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide github_url (GitHub PR URL), or title+diff, or prompt/content",
      });
    }
  });

export const ResponsePayload = z.object({
  response: z.string(),
});

export type RequestPayloadT = z.infer<typeof RequestPayload>;
export type ResponsePayloadT = z.infer<typeof ResponsePayload>;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

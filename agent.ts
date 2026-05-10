/**
 * codereview — Zynd network agent (public webhook + registry).
 *
 * Run from repo root: `npx zynd agent run` (uses `agent.config.json` + `.env`).
 * Requires `ZYND_ENTITY_URL` (e.g. ngrok HTTPS) for inbound calls.
 */

import "dotenv/config";
import * as fs from "node:fs";
import {
  ZyndAIAgent,
  AgentConfigSchema,
  resolveRegistryUrl,
  type HandlerInput,
  type TaskHandle,
} from "zyndai";

import { getPullRequestDiff } from "@/module/github/lib/github";
import { parseGithubPrUrl } from "@/module/github/lib/parse-github-pr-url";
import {
  formatRagContextForReview,
  generateFreeformReviewMarkdown,
  generatePrReviewMarkdown,
} from "@/module/ai/lib/pr-review-llm";

import {
  RequestPayload,
  ResponsePayload,
  MAX_FILE_SIZE_BYTES,
  type RequestPayloadT,
} from "./payload.js";

const _config: Record<string, unknown> = fs.existsSync("agent.config.json")
  ? (JSON.parse(fs.readFileSync("agent.config.json", "utf-8")) as Record<
      string,
      unknown
    >)
  : {};

function readCapabilitiesFromConfig():
  | { streaming?: boolean; pushNotifications?: boolean; stateTransitionHistory?: boolean }
  | undefined {
  const cap = _config.capabilities;
  if (!cap || typeof cap !== "object" || Array.isArray(cap)) return undefined;
  const c = cap as Record<string, unknown>;
  const out: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  } = {};
  if (typeof c.streaming === "boolean") out.streaming = c.streaming;
  if (typeof c.pushNotifications === "boolean")
    out.pushNotifications = c.pushNotifications;
  if (typeof c.stateTransitionHistory === "boolean")
    out.stateTransitionHistory = c.stateTransitionHistory;
  return Object.keys(out).length ? out : undefined;
}

function mergeJsonContentString(body: RequestPayloadT): RequestPayloadT {
  const gh = String(body.github_url ?? "").trim();
  const wire = String(body.prompt ?? body.content ?? "").trim();
  if (gh || !wire.startsWith("{")) return body;
  try {
    const inner = JSON.parse(wire) as Record<string, unknown>;
    const merged = { ...body, ...inner };
    const r = RequestPayload.safeParse(merged);
    return r.success ? r.data : body;
  } catch {
    return body;
  }
}

/** Combine `extra_instructions` with `prompt`/`content` for PR-based reviews. */
function mergeStructuredExtraInstructions(body: RequestPayloadT): string | undefined {
  const parts: string[] = [];
  const inst = body.extra_instructions?.trim();
  if (inst) parts.push(inst);
  const user = (body.prompt ?? body.content ?? "").trim();
  if (user) parts.push(`User question / focus:\n${user}`);
  return parts.length ? parts.join("\n\n---\n\n") : undefined;
}

/** One-off wire debugging: set `ZYND_DEBUG_WIRE=1`, POST once, read logs, unset. */
function logZyndWireDebug(input: HandlerInput): void {
  if (process.env.ZYND_DEBUG_WIRE !== "1") return;
  const inp = input as unknown as Record<string, unknown>;
  const payload = inp["payload"];
  const message = inp["message"] as Record<string, unknown> | undefined;
  const content = message?.["content"];
  console.log(
    "[zynd:wire]",
    JSON.stringify(
      {
        payloadKeys:
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? Object.keys(payload as Record<string, unknown>)
            : typeof payload,
        messageContentType: typeof content,
        messageContentPreview:
          typeof content === "string" ? content.slice(0, 500) : undefined,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const agentConfig = AgentConfigSchema.parse({
    name: (_config.name as string) ?? "codereview",
    description:
      (_config.description as string) ??
      "GitHub pull request code review — send a PR URL, get structured markdown.",
    version: (_config.version as string) ?? "0.1.0",
    category: (_config.category as string) ?? "developer-tools",
    tags: (Array.isArray(_config.tags) ? _config.tags : undefined) as
      | string[]
      | undefined,
    serverHost: (_config.server_host as string) ?? "0.0.0.0",
    serverPort: Number(
      process.env.ZYND_SERVER_PORT ??
        _config.server_port ??
        _config.webhook_port ??
        5000
    ),
    authMode: (_config.auth_mode as "strict" | "permissive" | "open") ?? "permissive",
    registryUrl: resolveRegistryUrl({
      fromConfigFile: _config.registry_url as string | undefined,
    }),
    keypairPath:
      process.env.ZYND_AGENT_KEYPAIR_PATH ?? (_config.keypair_path as string | undefined),
    entityUrl: process.env.ZYND_ENTITY_URL ?? (_config.entity_url as string | undefined),
    price: _config.price as string | undefined,
    entityPricing: _config.entity_pricing as
      | { base_price_usd: number; currency: string }
      | undefined,
    entityIndex: (_config.entity_index as number) ?? 0,
    skills: _config.skills as
      | Array<{
          id: string;
          name: string;
          description?: string;
          tags?: string[];
          examples?: string[];
        }>
      | undefined,
    fqan: _config.fqan as string | undefined,
    capabilities: readCapabilitiesFromConfig(),
  });

  const zyndAgent = new ZyndAIAgent(agentConfig, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod major-version mismatch vs zyndai
    payloadModel: RequestPayload as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod major-version mismatch vs zyndai
    outputModel: ResponsePayload as any,
    maxBodyBytes: MAX_FILE_SIZE_BYTES,
  });

  zyndAgent.onMessage(async (input: HandlerInput, task: TaskHandle) => {
    try {
      logZyndWireDebug(input);

      const merged = mergeJsonContentString(input.payload as RequestPayloadT);
      const parsed = RequestPayload.safeParse(merged);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(" ");
        return task.fail(msg || "Invalid request payload");
      }
      const body = parsed.data;

      const structuredExtra = mergeStructuredExtraInstructions(body);
      const useRag =
        body.use_rag === true && process.env.ENABLE_PUBLIC_RAG === "true";

      const githubUrl = body.github_url?.trim();
      if (githubUrl) {
        const token = process.env.GITHUB_READ_TOKEN?.trim();
        if (!token) {
          return task.fail(
            "GITHUB_READ_TOKEN is not set on this agent (required to fetch pull requests from github_url).",
          );
        }
        const { owner, repo, prNumber } = parseGithubPrUrl(githubUrl);
        const { title, description, diff, githubThreadContext } =
          await getPullRequestDiff(token, owner, repo, prNumber);
        let contextFromCodebase = "";
        if (useRag && process.env.PINECONE_DB_API_KEY) {
          try {
            const { retrieveContext } = await import("@/module/ai/lib/rag");
            const chunks = await retrieveContext(
              `${title}\n${description || ""}`,
              `${owner}/${repo}`
            );
            contextFromCodebase = formatRagContextForReview(chunks);
          } catch {
            contextFromCodebase = "";
          }
        }
        const review = await generatePrReviewMarkdown({
          title,
          description: description || "",
          diff,
          contextFromCodebase,
          githubThreadContext,
          extraInstructions: structuredExtra,
        });
        return { response: review };
      }

      const title = body.title?.trim();
      const diff = body.diff?.trim();
      if (title && diff) {
        const description = body.description?.trim() ?? "";
        const review = await generatePrReviewMarkdown({
          title,
          description,
          diff,
          contextFromCodebase: "",
          extraInstructions: structuredExtra,
        });
        return { response: review };
      }

      const freeform = (body.prompt ?? body.content ?? "").trim();
      if (!freeform) {
        return task.fail(
          "Provide github_url (GitHub PR URL), or title+diff, or prompt/content.",
        );
      }
      const review = await generateFreeformReviewMarkdown(
        freeform,
        body.extra_instructions?.trim()
      );
      return { response: review };
    } catch (e) {
      return task.fail(e instanceof Error ? e.message : String(e));
    }
  });

  await zyndAgent.start();

  if (!process.env.GITHUB_READ_TOKEN?.trim()) {
    console.warn(
      "[codereview] GITHUB_READ_TOKEN is not set — requests with github_url will fail until it is in the process environment (.env).",
    );
  }

  let publicOrigin = process.env.ZYND_ENTITY_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!publicOrigin) {
    try {
      publicOrigin = new URL(zyndAgent.cardUrl).origin;
    } catch {
      publicOrigin = "";
    }
  }

  console.log(`\ncodereview is running`);
  console.log(`A2A endpoint: ${zyndAgent.a2aUrl}`);
  console.log(`Agent card:   ${zyndAgent.cardUrl}`);
  if (publicOrigin) {
    console.log(`Health:       ${publicOrigin}/health`);
    console.log(`Sync invoke:  ${publicOrigin}/webhook/sync`);
    console.log(`JSON schema:  ${publicOrigin}/.well-known/agent.json`);
  }

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));

  if (process.stdin.isTTY) {
    console.log("Type 'exit' to quit\n");
    process.stdin.on("data", (buf) => {
      if (buf.toString().trim().toLowerCase() === "exit") process.exit(0);
    });
  } else {
    await new Promise<never>(() => {});
  }
}

main().catch((err) => {
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  } else {
    console.error(`Error: ${String(err)}`);
  }
  process.exit(1);
});

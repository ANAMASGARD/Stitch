# Stitch — agent memory (facts + shipped work)

Updated snapshot of what the codebase **actually contains**. Prefer this over stale assumptions.

## Stack (pinned intent)

- **Next.js** `16.2.x` App Router, **React** `19`, **TypeScript**, **Tailwind v4**, **RetroUI** (`components/retroui/`).
- **Auth:** `better-auth`.
- **DB:** Prisma + Postgres (`lib/db.ts`, `prisma/schema.prisma`).
- **GitHub:** `@octokit/core` + plugins via **`module/github/lib/octokit.ts`** (shared `Octokit` instance type); **`module/github/lib/github.ts`** REST/GraphQL + PR fetch + webhook + file crawl.
- **Jobs:** Inngest (`inngest/`, `app/api/inngest/route.ts`).
- **AI:** `ai` + `@ai-sdk/google` + `@openrouter/ai-sdk-provider`; shared review prompt in **`module/ai/lib/pr-review-llm.ts`**.
- **Vectors:** Pinecone (`lib/pinecone.ts`, `module/ai/lib/rag.ts`).

## Data model (current Prisma)

- **User**, **Session**, **Account**, **Verification**, **Repository**, **Review**.
- No **`UserUsage`** / subscription tier fields in schema yet — tiered billing is **product agenda**, not implemented DB-side.

## Major flows (implemented)

1. **Connect repo → index:** `module/repository/actions` → `repository.connected` → Inngest `indexRepo` → `getRepoFileContent` → `indexCodebase` → Pinecone.
2. **Dashboard PR review:** `module/ai/actions/index.ts` queues **Inngest** `pr.review.requested`; **`inngest/functions/review.ts`** loads user token, **`getPullRequestDiff`**, optional **`retrieveContext`**, **`generatePrReviewMarkdown`**, **`postReviewComment`**, persists **Review**.

## Zynd network agent — `codereview`

| Artifact | Role |
|----------|------|
| **`agent.ts`** | `ZyndAIAgent`: `onMessage` → validate **`payload.ts`** → PR fetch / review / optional lazy RAG → `{ response }`. |
| **`payload.ts`** | Zod **`RequestPayload`** / **`ResponsePayload`** — published as **`input_schema` / `output_schema`** on **`/.well-known/agent.json`**. Modes: `github_url`, `title`+`diff`, or `prompt`/`content`; JSON-in-string merge for wire quirks. |
| **`agent.config.json`** | Agent name, tags, skills, registry URL, port, capabilities for discovery card. |

**Fixes applied along the way:** Replaced `octokit` package with core+plugins to avoid `@octokit/app` resolution errors under **`npx zynd agent run`**. Removed `server-only` from **`rag.ts`**; RAG is **dynamic import** from **`agent.ts`** only when public RAG is enabled.

## MCP

- **`.github/mcp.json`:** GitHub official MCP (Docker) + **zyndai-mcp-server** (`npx`). Cursor users copy to **`.cursor/mcp.json`** or merge globally.

## Known gaps

- **`app/api/webhooks/github/route.ts`** — minimal handling.
- **Subscription / usage enforcement** — planned; schema does not yet mirror the old “UserUsage” story.
- Full **chat assistant** product surface beyond reviews — not wired end-to-end.

## Registry / ops

- Live listing: [ZyndAI Registry](https://www.zynd.ai/registry).
- SDK reference: [zyndai-ts-sdk](https://github.com/zyndai/zyndai-ts-sdk).

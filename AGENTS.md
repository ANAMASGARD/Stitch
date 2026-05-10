<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stitch Agent Handbook

Persistent guide for coding agents. Long-form onboarding, folder map, and **Zynd agent** details live in **`.github/copilot-instructions.md`**. Direction: **`.github/STEERING.md`**. Facts: **`.github/MEMORY.md`**.

## Product summary

Stitch is a Next.js App Router application for GitHub-aware developer workflows:

- User authentication (better-auth)
- Dashboard + settings + repositories + reviews
- GitHub API integration (Octokit core stack in **`module/github/lib/octokit.ts`**)
- Async indexing with **Inngest** (`repository.connected` → Pinecone)
- RAG: **`module/ai/lib/rag.ts`** + **`lib/pinecone.ts`**
- AI PR review: dashboard path via Inngest + shared **`module/ai/lib/pr-review-llm.ts`**
- **Zynd network agent** **`codereview`**: root **`agent.ts`**, schemas **`payload.ts`**, metadata **`agent.config.json`** — public webhook + registry listing ([Zynd registry](https://www.zynd.ai/registry))

## What we have achieved (recent)

- **`generatePrReviewMarkdown`** / **`generateFreeformReviewMarkdown`** centralized in **`module/ai/lib/pr-review-llm.ts`**; **`inngest/functions/review.ts`** uses the same contract as the Zynd agent.
- **`getPullRequestDiff`** enriches prompts with GitHub PR metadata (files, reviews, inline comments, issue comments) when generating reviews.
- **Zynd agent** validates **`payload.ts`** (`RequestPayload.safeParse` after JSON-in-content merge); **`ENABLE_PUBLIC_RAG`** gates Pinecone on public calls; RAG loaded **only when** `use_rag` + env allow (lazy `import()` — no `server-only` conflict with `npx zynd agent run`).
- **Octokit:** Repo uses **`@octokit/core` + plugins** via **`module/github/lib/octokit.ts`** instead of the **`octokit`** npm meta-package (fixes **`tsx` / Node** resolution issues with `@octokit/app`).
- **MCP:** Canonical **`/.github/mcp.json`** (GitHub MCP + **zyndai-mcp-server**). Cursor: copy to **`.cursor/mcp.json`** or merge into user config.
- **Docs:** **`docs/zynd-agent-env.md`** — env, **`GET /health`**, **`/.well-known/agent.json`**, **`POST /webhook/sync`**, wire-debug **`ZYND_DEBUG_WIRE`**.

## Tech stack

- **Framework:** Next.js **16.2.x** App Router (Turbopack in dev)
- **Styling:** Tailwind CSS v4 — tokens in **`app/globals.css`** (`@theme`); no standalone `tailwind.config.js`
- **UI:** **RetroUI** in **`components/retroui/`** first; **`components/ui/`** (shadcn-style) secondary
- **Auth:** better-auth
- **Database:** Prisma + Postgres (`@prisma/client` + adapter)
- **GitHub:** **`module/github/lib/octokit.ts`** + **`module/github/lib/github.ts`**
- **Jobs:** Inngest
- **AI:** `ai` SDK + `@ai-sdk/google` + `@openrouter/ai-sdk-provider`
- **Zynd:** `zyndai` SDK (**`agent.ts`**)

## Design system (RetroUI)

- Typography: **Archivo Black** (`--font-head`), **Space Grotesk** (`--font-sans`)
- `--radius: 0`, hard shadows, primary **`#ffdb33`**
- Use **`components/retroui/*`** for new UI

## Project structure (code map)

| Area | Contents |
|------|----------|
| `app/` | Routes, layouts, API handlers |
| `module/` | Domain: `ai`, `auth`, `dashboard`, `github`, `repository`, `review`, `settings`, `landing` |
| `inngest/` | Client + **`functions/`** (`indexRepo`, **`generateReview`**, …) |
| `components/` | `retroui/`, `ui/`, `ai-elements/`, `providers/` |
| `lib/` | `db`, `auth`, `pinecone`, utilities |
| `prisma/` | Schema + migrations |
| Root | **`agent.ts`**, **`payload.ts`**, **`agent.config.json`** — Zynd **`codereview`** agent only |

### Routing (`app/`)

- `app/page.tsx` — landing
- `app/(auth)/login/page.tsx` — login
- `app/dashboard/*` — dashboard shell, repos, reviews, settings
- `app/api/auth/[...all]/route.ts` — Better Auth
- `app/api/webhooks/github/route.ts` — GitHub webhook (minimal)
- `app/api/inngest/route.ts` — Inngest `serve(...)`

### Repository (`module/repository/`)

- **`actions/index.ts`**: fetch/connect/disconnect; **`repository.connected`** for indexing

### GitHub (`module/github/`)

- **`lib/octokit.ts`**: shared **`Octokit`** (REST + GraphQL + pagination + retry + throttling)
- **`lib/github.ts`**: token helpers, GraphQL contributions, repos, webhooks, **`getRepoFileContent`**, **`getPullRequestDiff`**, **`postReviewComment`**

### Background jobs (`inngest/`)

- **`indexRepo`** — `repository.connected` → fetch files → **`indexCodebase`**
- **`generateReview`** — `pr.review.requested` → diff + optional RAG → **`generatePrReviewMarkdown`** → comment + **`Review`** row

### AI (`module/ai/`)

- **`lib/rag.ts`** — chunk, embed, Pinecone upsert/query (**no `server-only`** — usable from Zynd process when dynamically imported)
- **`lib/pr-review-llm.ts`** — shared markdown review generation

### Zynd agent (root)

| File | Purpose |
|------|---------|
| **`agent.config.json`** | Agent identity for registry: name **`codereview`**, tags, **`registry_url`**, skills |
| **`payload.ts`** | Zod **`RequestPayload`** / **`ResponsePayload`** → published **`input_schema` / `output_schema`** |
| **`agent.ts`** | **`ZyndAIAgent`**: **`onMessage`** returns **`{ response }`**; **`mergeJsonContentString`** for judge wire formats |

## End-to-end flows

### Connect repo → index

1. UI → **`connectRepository`**
2. Webhook + DB + **`repository.connected`**
3. **Inngest** fetches files → **RAG** → Pinecone

### Dashboard PR review

1. **`module/ai/actions`** queues **`pr.review.requested`**
2. **`inngest/functions/review.ts`**: OAuth token → **`getPullRequestDiff`** → optional **`retrieveContext`** → **`generatePrReviewMarkdown`** → GitHub comment

### Zynd public agent

1. Caller **`POST {{ZYND_ENTITY_URL}}/webhook/sync`** with JSON per **`payload.ts`**
2. **`GITHUB_READ_TOKEN`** fetches PR when **`github_url`** present
3. Returns markdown **`response`**; optional RAG behind **`ENABLE_PUBLIC_RAG`**

## Environment expectations

- **`PINECONE_DB_API_KEY`**, **`NEXT_PUBLIC_APP_BASE_URL`**
- DB URL for Prisma / Postgres
- Better Auth secrets
- GitHub OAuth (dashboard)
- LLM: **`OPENROUTER_API_KEY`**, **`GOOGLE_GENERATIVE_AI_API_KEY`**
- Zynd agent: **`ZYND_AGENT_KEYPAIR_PATH`**, **`ZYND_ENTITY_URL`**, **`GITHUB_READ_TOKEN`** (PR URL mode)

## Known gaps

- **`app/api/webhooks/github/route.ts`** — minimal processing
- Repository usage quotas — not fully enforced in **`connectRepository`**
- Subscription tier / **UserUsage** — steering goal; current Prisma schema is User + Repository + Review only (see **`MEMORY.md`**)

## Agent operating guidelines

1. Normalize **`owner/repo`** before GitHub API calls.
2. Keep heavy async work in **Inngest**, not in thin API routes.
3. Preserve RAG chunk/metadata compatibility when editing **`rag.ts`**.
4. Extend **`module/*`** boundaries; avoid utility sprawl.
5. Keep UI aligned with **RetroUI** tokens.
6. Do not reintroduce the **`octokit`** npm package at repo root — use **`@/module/github/lib/octokit`**.

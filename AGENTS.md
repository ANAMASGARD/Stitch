<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stitch Agent Handbook

Persistent guide for coding agents. Long-form onboarding, folder map, and **Zynd agent** details live in **`.github/copilot-instructions.md`**. Direction: **`.github/STEERING.md`**. Facts: **`.github/MEMORY.md`**. Repo overview demo: **[Stitch AI on YouTube](https://youtu.be/LgnPk0i05wU?si=eO8ocnSHS2ATWhQq)** (linked from **`README.md`** — hero thumbnail + link).

## Product summary

Stitch is a Next.js App Router application for GitHub-aware developer workflows:

- User authentication (better-auth)
- Dashboard: home, repositories, **reviews** (PR history + issue automation), **pull-requests** (Stitch **`AutoPullRequest`** list), **chat** (RAG-backed repo Q&A, persisted threads), settings (incl. GitHub re-auth). Some sidebar destinations are still roadmap-only — see **Known gaps**.
- GitHub API integration (Octokit core stack in **`module/github/lib/octokit.ts`**)
- Async indexing with **Inngest** (`repository.connected` → Pinecone)
- RAG: **`module/ai/lib/rag.ts`** + **`lib/pinecone.ts`**
- AI PR review: dashboard path via Inngest + shared **`module/ai/lib/pr-review-llm.ts`**
- **Issue automation:** GitHub webhook (signed) → Inngest **`analyzeIssue`** (triage comment) + **`createIssueFixPullRequest`** (collaborator-gated **`/stitch fix`** → branch/PR); LLM **`module/ai/lib/issue-to-pr-llm.ts`**; history on dashboard reviews page + **`IssueAnalysis`** / **`AutoPullRequest`** in Prisma
- **Zynd network agent** **`codereview`**: root **`agent.ts`**, schemas **`payload.ts`**, metadata **`agent.config.json`** — public webhook + registry listing ([Zynd registry](https://www.zynd.ai/registry))

## What we have achieved (recent)

- **Next.js Cache Components:** `next.config.ts` sets **`cacheComponents: true`**. **`app/(auth)/login/page.tsx`** wraps the async session gate (**`requireUnAuth`**) in **`<Suspense>`** with a RetroUI fallback so **`next build`** does not hit “uncached data outside Suspense” on `/login`.
- **GitHub OAuth (seamless):** **`lib/auth.ts`** requests **`read:user`**, **`user:email`**, **`repo`**, **`admin:repo_hook`**. **`module/settings/components/github-permissions-card.tsx`** + Settings page: **“Refresh GitHub permissions”** re-runs **`signIn.social({ provider: "github", callbackURL: "/dashboard/settings" })`** for users who signed in before scope changes. **`GITHUB_WEBHOOK_SECRET`** is operator-only (documented in **`.env.example`** / **`README.md`**); users never see it.
- **Reviews dashboard resilience:** **`app/dashboard/reviews/page.tsx`** uses **two** React Query keys (`reviews` vs `issue-automation`) so **`getIssueAutomationHistory`** failures do not blank PR review history; **`module/issue/actions`** defensively handles a stale Prisma singleton missing new models.
- **Stitch pull requests UI:** **`app/dashboard/pull-requests/page.tsx`** + **`module/pull-request/actions/index.ts`** list **`AutoPullRequest`** rows (Stitch **`/stitch fix`** runs) with RetroUI cards; **`parseStoredStitchIssueFixPlan`** in **`module/ai/lib/issue-to-pr-llm.ts`** safely parses **`planJson`** (Zod).
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
| `module/` | Domain: `ai`, `auth`, `dashboard`, `github`, `repository`, `review`, `issue`, **`pull-request`**, **`chat`**, `settings`, `landing` |
| `inngest/` | Client + **`functions/`** (`indexRepo`, **`generateReview`**, **`analyzeIssue`**, **`createIssueFixPullRequest`**, …) |
| `components/` | `retroui/`, `ui/`, `ai-elements/`, `providers/` |
| `lib/` | `db`, `auth`, `pinecone`, **`github-webhook-verify`**, **`stitch-github-commands`**, utilities |
| `prisma/` | Schema + migrations |
| Root | **`agent.ts`**, **`payload.ts`**, **`agent.config.json`** — Zynd **`codereview`** agent only |

### Routing (`app/`)

- `app/page.tsx` — landing
- `app/(auth)/login/page.tsx` — login (**Suspense** + async child for Cache Components)
- `app/dashboard/*` — dashboard shell, repos, **reviews** (reviews + issue automation sections), **pull-requests** (Stitch **`AutoPullRequest`** list), **chat** (Pinecone-scoped threads), settings
- `app/api/auth/[...all]/route.ts` — Better Auth
- `app/api/webhooks/github/route.ts` — GitHub webhook: **`GITHUB_WEBHOOK_SECRET`** + `x-hub-signature-256` (**`lib/github-webhook-verify.ts`**), **`pull_request` / `issues` / `issue_comment`** → Inngest; **`/stitch fix`** detection via **`lib/stitch-github-commands.ts`**
- `app/api/chat/route.ts` — authenticated **`POST`**: UI message stream; **`retrieveContext(lastUserText, repository.fullName)`** (Pinecone **`repoId`** = `fullName`); persists **`ChatSession`** / **`ChatMessage`**
- `app/api/inngest/route.ts` — Inngest `serve(...)`

### Repository (`module/repository/`)

- **`actions/index.ts`**: fetch/connect/disconnect; **`repository.connected`** for indexing

### GitHub (`module/github/`)

- **`lib/octokit.ts`**: shared **`Octokit`** (REST + GraphQL + pagination + retry + throttling)
- **`module/github/lib/github.ts`**: token helpers, GraphQL contributions, repos, webhooks, **`getRepoFileContent`**, **`getPullRequestDiff`**, **`postReviewComment`**, issue/branch/contents/PR helpers (**`postIssueComment`**, **`createBranchFromDefault`**, **`createPullRequest`**, **`getCollaboratorPermissionLevel`**, …)

### Background jobs (`inngest/`)

- **`indexRepo`** — `repository.connected` → fetch files → **`indexCodebase`**
- **`generateReview`** — `pr.review.requested` → diff + optional RAG → **`generatePrReviewMarkdown`** → comment + **`Review`** row
- **`analyzeIssue`** — `issue.analysis.requested` → RAG (≥3 chunks) → triage LLM → issue comment + **`IssueAnalysis`**
- **`createIssueFixPullRequest`** — `issue.auto_pr.requested` → permission + plan + file writes → PR + **`AutoPullRequest`**

### AI (`module/ai/`)

- **`lib/rag.ts`** — chunk, embed, Pinecone upsert/query (**no `server-only`** — usable from Zynd process when dynamically imported)
- **`lib/pr-review-llm.ts`** — shared markdown review generation
- **`module/ai/lib/issue-to-pr-llm.ts`** — issue triage + fix plan + per-file generation (Zod-validated JSON)

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

1. **`module/ai/actions`** queues **`pr.review.requested`** (or GitHub **`pull_request`** webhook enqueues the same event)
2. **`inngest/functions/review.ts`**: OAuth token → **`getPullRequestDiff`** → optional **`retrieveContext`** → **`generatePrReviewMarkdown`** → GitHub comment

### Issue triage + `/stitch fix` auto-PR

1. GitHub **`issues`** / **`issue_comment`** webhook (verified) → **`issue.analysis.requested`** / **`issue.auto_pr.requested`**
2. **`inngest/functions/issue.ts`**: RAG guardrails (min 3 chunks), triage or command-gated writes; collaborator must have **write/maintain/admin**

### Zynd public agent

1. Caller **`POST {{ZYND_ENTITY_URL}}/webhook/sync`** with JSON per **`payload.ts`**
2. **`GITHUB_READ_TOKEN`** fetches PR when **`github_url`** present
3. Returns markdown **`response`**; optional RAG behind **`ENABLE_PUBLIC_RAG`**

## Environment expectations

- **`PINECONE_DB_API_KEY`**, **`NEXT_PUBLIC_APP_BASE_URL`**
- DB URL for Prisma / Postgres
- Better Auth secrets
- GitHub OAuth (dashboard): scopes in **`lib/auth.ts`** (`repo`, **`admin:repo_hook`**, profile/email); **`GITHUB_WEBHOOK_SECRET`** (repo webhook HMAC, operator-only)
- LLM: **`OPENROUTER_API_KEY`**, **`GOOGLE_GENERATIVE_AI_API_KEY`**
- Zynd agent: **`ZYND_AGENT_KEYPAIR_PATH`**, **`ZYND_ENTITY_URL`**, **`GITHUB_READ_TOKEN`** (PR URL mode)

## Known gaps

- **Sidebar:** items like **Chat** and **Rules** may still point at routes **not implemented** under `app/dashboard/` — only add nav entries when the page exists.

## Agent operating guidelines

1. Normalize **`owner/repo`** before GitHub API calls.
2. Keep heavy async work in **Inngest**, not in thin API routes.
3. Preserve RAG chunk/metadata compatibility when editing **`rag.ts`**.
4. Extend **`module/*`** boundaries; avoid utility sprawl.
5. Keep UI aligned with **RetroUI** tokens.
6. Do not reintroduce the **`octokit`** npm package at repo root — use **`@/module/github/lib/octokit`**.

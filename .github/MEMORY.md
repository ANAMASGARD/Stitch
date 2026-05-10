# Stitch — agent memory (facts + shipped work)

Updated snapshot of what the codebase **actually contains**. Prefer this over stale assumptions.

## Stack (pinned intent)

- **Next.js** `16.2.x` App Router, **React** `19`, **TypeScript**, **Tailwind v4**, **RetroUI** (`components/retroui/`). **`next.config.ts`**: **`cacheComponents: true`** — auth-gated pages that read request/session on the server follow the **`/login`** **`<Suspense>`** pattern.
- **Auth:** `better-auth`; GitHub OAuth scopes in **`lib/auth.ts`**: **`read:user`**, **`user:email`**, **`repo`**, **`admin:repo_hook`** (webhooks + repo content; existing users re-consent via Settings **“Refresh GitHub permissions”**).
- **DB:** Prisma + Postgres (`lib/db.ts`, `prisma/schema.prisma`).
- **GitHub:** `@octokit/core` + plugins via **`module/github/lib/octokit.ts`** (shared `Octokit` instance type); **`module/github/lib/github.ts`** REST/GraphQL + PR fetch + repo webhooks + file crawl + issue/branch/contents/PR helpers.
- **Jobs:** Inngest (`inngest/`, `app/api/inngest/route.ts`).
- **AI:** `ai` + `@ai-sdk/google` + `@openrouter/ai-sdk-provider`; shared review prompt in **`module/ai/lib/pr-review-llm.ts`**.
- **Vectors:** Pinecone (`lib/pinecone.ts`, `module/ai/lib/rag.ts`).

## Data model (current Prisma)

- **User**, **Session**, **Account**, **Verification**, **Repository**, **Review**, **IssueAnalysis**, **AutoPullRequest**.
- No **`UserUsage`** / subscription tier fields in schema yet — tiered billing is **product agenda**, not implemented DB-side.

## Major flows (implemented)

1. **Connect repo → index:** `module/repository/actions` → `repository.connected` → Inngest `indexRepo` → `getRepoFileContent` → `indexCodebase` → Pinecone.
2. **Dashboard PR review:** `module/ai/actions/index.ts` queues **Inngest** `pr.review.requested` (same event can be sent from **`app/api/webhooks/github/route.ts`** on `pull_request` opened/synchronize); **`inngest/functions/review.ts`** loads user token, **`getPullRequestDiff`**, optional **`retrieveContext`**, **`generatePrReviewMarkdown`**, **`postReviewComment`**, persists **Review**.
3. **Issue automation:** Verified GitHub webhook (`GITHUB_WEBHOOK_SECRET`, `x-hub-signature-256`, **`lib/github-webhook-verify.ts`**) → **`issue.analysis.requested`** / **`issue.auto_pr.requested`** → **`inngest/functions/issue.ts`** (RAG floor, triage comment, collaborator-gated **`/stitch fix`** → branch/commits/PR). Command detection: **`lib/stitch-github-commands.ts`**. LLM: **`module/ai/lib/issue-to-pr-llm.ts`** (incl. **`parseStoredStitchIssueFixPlan`** for persisted **`AutoPullRequest.planJson`**). Dashboard: **`module/issue/actions`**, “Issue automation” section on **`app/dashboard/reviews/page.tsx`** (separate React Query from reviews so one failure does not blank the other).
4. **Stitch pull requests page:** **`app/dashboard/pull-requests/page.tsx`** + **`module/pull-request/actions/getStitchPullRequests`** lists **`AutoPullRequest`** for the signed-in user (RetroUI cards, status color map, optional plan block). Sidebar already links **`/dashboard/pull-requests`**.
5. **Auth / Next.js 16:** **`lib/auth.ts`** GitHub scopes include **`admin:repo_hook`** for webhook registration. **`app/(auth)/login/page.tsx`**: sync shell + **`<Suspense>`** around async **`requireUnAuth`** + **`LoginUI`** for **`cacheComponents`** builds. Settings: **`GithubPermissionsCard`** for re-OAuth.

## Operational notes for agents

- After **Prisma schema** changes: run **`npx prisma generate`** and **restart** the Next dev server (global Prisma singleton in dev can otherwise miss new delegates like **`issueAnalysis`** / **`autoPullRequest`** until restart).
- **`createWebhook`** (**`module/github/lib/github.ts`**) requires **`GITHUB_WEBHOOK_SECRET`** in env; updates existing hooks (events + secret) when the Stitch webhook URL already exists.

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

- **Subscription / usage enforcement** — planned; schema does not yet mirror the old “UserUsage” story.
- Full **chat assistant** product surface beyond reviews — not wired end-to-end.
- **Sidebar routes:** **Chat**, **Rules**, **Subscription** (and any similar nav items) may not have matching **`app/dashboard/.../page.tsx`** files yet — verify before assuming they work.

## Registry / ops

- Live listing: [ZyndAI Registry](https://www.zynd.ai/registry).
- SDK reference: [zyndai-ts-sdk](https://github.com/zyndai/zyndai-ts-sdk).

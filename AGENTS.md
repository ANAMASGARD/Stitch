<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stitch Agent Handbook

This file is the persistent project memory for coding agents. It documents how the codebase is organized, what has been implemented, and how major flows work right now.

## Product Summary

Stitch is a Next.js App Router application for GitHub-aware developer workflows:
- user authentication
- dashboard + settings views
- repository connect/disconnect
- GitHub API integration (Octokit)
- async indexing pipeline using Inngest
- RAG indexing + retrieval using Pinecone and Gemini embeddings
- AI-powered code review for GitHub pull requests

## 🛠️ Tech Stack & Architecture
- **Framework:** Next.js 16.2.3 App Router (Turbopack enabled)
- **Styling:** Tailwind CSS v4
  - *Note for Agents:* Tailwind v4 uses the `@theme` block in `app/globals.css` instead of a standalone `tailwind.config.js`. CSS variables control the entire design system. Do not look for or try to create tailwind config files.
- **UI Foundations:**
  - `shadcn/ui` configured (`components.json` is present, `components/ui/` for standard elements with `radix-nova` style).
  - **RetroUI**: Custom pre-built retro-style components reside in `components/retroui/` (e.g., Accordion, Dialog, Input, Tab, etc.). Favor leveraging these over standard ui when writing visual elements.
- **State/Primitives:** Radix UI primitives (`@radix-ui/react-*`), cmkd, Embla Carousel.

## 🎨 Design System (RetroUI)
Maintain the designated retro aesthetic unconditionally across all new features.
- **Typography:**
  - Headings: `Archivo Black` via `next/font` (CSS variable: `--font-head`)
  - Body/Sans: `Space Grotesk` via `next/font` (CSS variable: `--font-sans`)
- **Colors & Aesthetics:**
  - Primary Theme: Vibrant Yellow (`#ffdb33`), stark whites, and heavy blacks (`#000`).
  - Edges: Zero border radius (`--radius: 0`) for sharp, blocky box elements.
  - Shadows: Hard, distinct shadows using border logic (e.g., `--shadow: 3px 3px 0 0 var(--border)`).
  - Focus/Rings (`--ring`): Mapped to the primary yellow to match the retro look and ensure Tailwind v4 compiler compatibility with `outline-ring/50`.

## Current Stack

## 🕰️ Development History Log
- **Phase 1 (Initialization):** Scaffolded base Next.js 16.2.3 app with Tailwind v4 and React 19.
- **Phase 2 (Design Setup):**
  - Applied Archivo Black and Space Grotesk mapping globally via `app/layout.tsx`.
  - Replaced the default CSS theme loop with custom RetroUI variables in `globals.css` (`@theme`, `:root`, `.dark`).
- **Phase 3 (Tailwind v4 Fixs):**
  - Resolved a fatal `outline-ring/50` evaluation build error in Tailwind CSS v4. The error was fixed by explicitly defining `--color-ring` in `@theme` and mapping `--ring` tokens inside `:root`/`.dark` to ensure legacy standard classes compiled correctly.

- Framework: Next.js `16.2.3` (App Router)
- Runtime/UI: React `19`, TypeScript, Tailwind CSS v4
- Auth: `better-auth`
- Database ORM: Prisma (`@prisma/client` + `@prisma/adapter-pg`)
- GitHub API: `octokit`
- Async jobs: `inngest`
- AI/RAG: `ai` SDK + `@ai-sdk/google` + Pinecone

## Non-Negotiable Styling Rules

The app uses a retro visual system:
- Keep sharp corners (`--radius: 0`)
- Keep hard/offset shadow style (no soft modern blur aesthetic)
- Use design tokens in `app/globals.css` `@theme` (Tailwind v4 convention)
- Reuse `components/retroui/*` first before introducing new patterns

## Project Structure (Code Map)

Top-level map:

- `app/`: routes, layouts, and API handlers
- `module/`: domain modules (auth, dashboard, github, repository, settings, ai)
- `inngest/`: Inngest client + background functions
- `components/`: shared UI (`retroui` and `ui`)
- `lib/`: infrastructure clients (`db`, `auth`, `pinecone`, utils)
- `prisma/`: schema + migrations

Detailed map:

### Routing Layer (`app/`)

- `app/page.tsx`: landing/root page
- `app/(auth)/login/page.tsx`: login page
- `app/dashboard/layout.tsx`: dashboard shell
- `app/dashboard/page.tsx`: dashboard home
- `app/dashboard/repositories/page.tsx`: repositories page
- `app/dashboard/settings/page.tsx`: settings page
- `app/api/auth/[...all]/route.ts`: auth routes
- `app/api/webhooks/github/route.ts`: GitHub webhook endpoint (currently minimal handling)
- `app/api/inngest/route.ts`: Inngest handler endpoint (`serve(...)`)

### Repository Domain (`module/repository/`)

- `module/repository/actions/index.ts`
  - `fetchRepositories(page, pageNumber)`
    - fetches GitHub repos
    - marks repos as connected if present in DB
  - `connectRepository(owner, repo, githubId)`
    - validates session + normalizes owner/repo
    - creates GitHub webhook
    - persists repository row in DB
    - fires Inngest event `repository.connected` (fire-and-forget) for indexing
  - `disconnectRepository(githubId)`
    - deletes repository rows by `githubId` + `userId`
- `module/repository/hooks/*`: query/mutation hooks for connect/disconnect/fetch
- `module/repository/components/repository-skeleton.tsx`: loading UI

### GitHub Integration (`module/github/`)

- `module/github/lib/github.ts`
  - token/session resolver: `getGithubToken()`
  - contributions:
    - `fetchUserContribution(...)`
    - `fetchGithubContributionSummary(...)`
  - repositories: `getRepositories(...)`
  - webhook lifecycle:
    - `createWebhook(owner, repo)`
    - `deleteWebhook(owner, repo)`
  - repository file ingestion:
    - `getRepoFileContent(token, owner, repo, path?)`
    - supports:
      - direct single-file content
      - folder traversal
      - recursive descent into subdirectories
      - simple binary extension filtering before decoding base64 content

### Background Jobs (`inngest/`)

- `inngest/client.ts`: Inngest client initialization
- `inngest/functions/index.ts`:
  - `indexRepo` function triggered by `repository.connected`
  - flow:
    - validate payload (`owner`, `repo`, `userId`)
    - load GitHub account access token from Prisma
    - fetch repository files via `getRepoFileContent(...)`
    - index files via `indexCodebase(...)`
    - return indexing summary
- `app/api/inngest/route.ts` registers `indexRepo` with `serve(...)`

### AI + RAG (`module/ai/`, `lib/pinecone.ts`)

- `lib/pinecone.ts`
  - initializes Pinecone client
  - uses index name `stitch-ai`
- `module/ai/lib/rag.ts`
  - `indexCodebase(repoId, files)`:
    - formats content
    - chunks files (size/overlap strategy)
    - embeds using Gemini embedding model
    - upserts vectors to Pinecone with metadata
  - `generateEmbedding(text)` for retrieval query embedding
  - `retrieveContext(query, repoId, topK?)` for semantic context lookup

### Auth + Core Infra

- `lib/auth.ts`: auth server setup
- `lib/auth-client.ts`: auth client setup
- `lib/db.ts`: Prisma DB client
- `prisma/schema.prisma` models:
  - `User`
  - `Repository` (connected repos table)
  - `Session`
  - `Account` (stores provider tokens, incl. GitHub access token)
  - `Verification`

## End-to-End Flow (Implemented)

### Connect Repository -> Index Codebase

1. User triggers connect from repository UI.
2. `connectRepository(...)` creates webhook + stores repository in DB.
3. `connectRepository(...)` sends Inngest event `repository.connected`.
4. `indexRepo` Inngest function receives event.
5. Function loads user GitHub token from `Account`.
6. Function fetches repo files recursively via GitHub API.
7. Function chunks + embeds + upserts to Pinecone via `indexCodebase`.

## Important Environment Expectations

The following are used in code and expected at runtime:
- `PINECONE_DB_API_KEY`
- `NEXT_PUBLIC_APP_BASE_URL`
- database connection env for Prisma/PG
- auth-related secrets/env expected by Better Auth setup

## Known Status / Gaps

- `app/api/webhooks/github/route.ts` currently acknowledges events, with TODO for full processing.
- Repository usage quotas/tracking are still TODO in `connectRepository`.
- RAG retrieval exists, but chat/assistant orchestration layer is not yet wired in this map.

## Agent Operating Guidelines For This Repo

1. Validate and normalize `owner/repo` inputs before GitHub API calls.
2. Keep async heavy work in Inngest functions, not in request handlers.
3. For RAG updates, preserve chunking/embedding metadata compatibility.
4. Prefer extending existing module boundaries instead of creating cross-cutting utility sprawl.
5. Keep UI consistent with RetroUI tokens/components.

# Stitch — steering (product + engineering)

Use this file for **direction and priorities**. Pair with `MEMORY.md` (what is true today) and `AGENTS.md` (how to work in the repo).

## Product north star

Stitch is a **GitHub-aware developer workspace** on **Next.js App Router**: connect repos, index code in the background, and surface **AI-assisted PR review** using repo context where available.

## Near-term agenda

1. Authenticate users and connect GitHub repositories.
2. Index connected repositories asynchronously with **Inngest**.
3. Store vectorized context in **Pinecone** for retrieval.
4. Use retrieved context in **dashboard** review flows and optional **public Zynd** RAG path.
5. **Roadmap:** subscription and usage limits on connect/review actions (not fully modeled in DB yet — see `MEMORY.md`).

## Public Zynd agent (`codereview`)

- **Purpose:** Standalone network agent for demos/judges: send a PR URL (or title+diff / freeform), receive structured markdown review.
- **Entry:** repo root `agent.ts`, config `agent.config.json`, schemas `payload.ts`.
- **Registry:** `zyndAgent.start()` upserts to Zynd registry — no separate publish CLI. Requires **`ZYND_ENTITY_URL`** (public HTTPS, e.g. ngrok) and **`ZYND_AGENT_KEYPAIR_PATH`** (or private key env).
- **GitHub:** Server-side **`GITHUB_READ_TOKEN`** for `github_url` mode only (never sent by callers).
- **RAG:** Opt-in: client `use_rag: true` **and** server **`ENABLE_PUBLIC_RAG=true`** **and** Pinecone env; lazy-loaded so the agent process does not require RAG at startup.

## Engineering constraints

- **Next.js:** Treat as **Next 16.x** — check `node_modules/next/dist/docs/` for APIs that differ from older training data.
- **UI:** RetroUI + Tailwind v4 tokens in `app/globals.css`; no standalone `tailwind.config.js`.
- **Heavy work:** Prefer **Inngest** for long GitHub fetch + embedding pipelines, not plain route handlers.
- **GitHub API:** Use **`@/module/github/lib/octokit`** (`Octokit` preset) and **`github.ts`** — do not reintroduce the `octokit` meta-package (breaks `tsx` / Node resolution for the Zynd runner).

## MCP / tooling

- Canonical MCP definitions: **`.github/mcp.json`** (GitHub MCP + ZyndAI MCP). Cursor loads **`.cursor/mcp.json`** — copy or merge from `.github/mcp.json` if needed.

## Documentation map

| File | Role |
|------|------|
| `AGENTS.md` | Agent handbook + code map |
| `.github/copilot-instructions.md` | Copilot-oriented overview + tree |
| `.github/MEMORY.md` | Shipped features and decisions |
| `docs/zynd-agent-env.md` | Zynd agent env + smoke tests |

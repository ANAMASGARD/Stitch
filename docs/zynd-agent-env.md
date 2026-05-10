# Zynd `codereview` agent — environment variables

Use this when running **`npx zynd agent run`** from the repo root (same `.env` as Next is fine; only the variables below are required for the agent process).

## Zynd / network (required for registry + webhooks)

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| **`ZYND_AGENT_KEYPAIR_PATH`** | Yes (unless you use `ZYND_AGENT_PRIVATE_KEY`) | Created by **`npx zynd agent init`** → path like `~/.zynd/agents/codereview/keypair.json`. Not the dashboard “public key” — that is a different credential. |
| **`ZYND_AGENT_PRIVATE_KEY`** | Alternative to path | Base64 private key from zyndai README / key export (advanced). |
| **`ZYND_ENTITY_URL`** | Yes for public demos | **HTTPS** public origin only (no path, no trailing slash). Local: run **`ngrok http 5000`** (or your `server_port`), copy `https://….ngrok-free.app`, set this, **restart** the agent. |
| **`ZYND_REGISTRY_URL`** | Optional | Default `https://zns01.zynd.ai` (federated registry). |
| **`ZYND_SERVER_PORT`** | Optional | TCP port the agent binds (default **5000**). Must match ngrok’s upstream port. |

**First-time machine setup**

1. **`npx zynd init`** — creates `~/.zynd/developer.json` (developer identity).
2. **`npx zynd agent init`** (if you need a fresh keypair) — creates `~/.zynd/agents/<slug>/keypair.json` and can write `.env` stubs.

Registration happens automatically inside **`zyndAgent.start()`** — there is no separate “publish” CLI. Open [zynd.ai/registry](https://www.zynd.ai/registry) after the agent is running with a valid `ZYND_ENTITY_URL`.

### Go live — checklist (everything required to “publish” the agent)

Do these on the machine that will run the demo (order matters):

| Step | Action |
|------|--------|
| 1 | **Node 18+** and repo **`npm install`** (so `zyndai` and `tsx` resolve). |
| 2 | **`npx zynd init`** once → `~/.zynd/developer.json`. |
| 3 | **`ZYND_AGENT_KEYPAIR_PATH`** (or `ZYND_AGENT_PRIVATE_KEY`) from **`npx zynd agent init`** / your existing codereview keypair. |
| 4 | **`ZYND_ENTITY_URL`** = public **HTTPS** origin only (no path). Local: **`ngrok http <port>`** where `<port>` matches **`ZYND_SERVER_PORT`** (default **5000**). Restart the agent whenever the tunnel URL changes. |
| 5 | **LLM keys** in `.env`: **`OPENROUTER_API_KEY`**, **`GOOGLE_GENERATIVE_AI_API_KEY`**. |
| 6 | For **`github_url`** demos: **`GITHUB_READ_TOKEN`** in `.env` (same shell / process loads `dotenv` via `agent.ts`). |
| 7 | From repo root: **`npx zynd agent run`** — wait for “codereview is running” and printed URLs. |

**Smoke tests (before judges):**

1. **`GET {{ZYND_ENTITY_URL}}/health`** — expect JSON with **`status`** (e.g. ok) and **`entity_id`**. Fast proof the tunnel reaches your process.
2. **`GET {{ZYND_ENTITY_URL}}/.well-known/agent.json`** — confirm **`input_schema`** / **`output_schema`** list fields such as **`github_url`**, **`prompt`**, **`content`**, **`title`**, **`diff`**. If those are missing, the registry card is not advertising your Zod model.
3. **`POST {{ZYND_ENTITY_URL}}/webhook/sync`** with a small public PR body (see below). Stay under the **~30s** sync limit.

**One live wire capture (recommended once):**

1. Set **`ZYND_DEBUG_WIRE=1`** in `.env`, restart **`npx zynd agent run`**, send one **`POST …/webhook/sync`** with your real judge-shaped JSON.
2. Read the terminal line **`[zynd:wire]`** — it logs **`payloadKeys`**, **`messageContentType`**, and a short **`messageContentPreview`** (no secrets).
3. Unset **`ZYND_DEBUG_WIRE`** after you know how **`payload`** vs **`message.content`** arrives.

**Negative test (invalid body):**

`POST …/webhook/sync` with **`{ "random_field": "hello" }`** should return a **clear validation error** (not hang 30s): *Provide github_url (GitHub PR URL), or title+diff, or prompt/content.*

## LLM (required for reviews)

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| **`OPENROUTER_API_KEY`** | Yes | [OpenRouter — API keys](https://openrouter.ai/keys) |
| **`GOOGLE_GENERATIVE_AI_API_KEY`** | Yes (fallback + embeddings if RAG runs) | [Google AI Studio](https://aistudio.google.com/apikey) |

Same keys as the Inngest PR review job in [`inngest/functions/review.ts`](../inngest/functions/review.ts).

## GitHub (required when callers send `github_url`)

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| **`GITHUB_READ_TOKEN`** | Yes for PR URL mode | GitHub → **Settings → Developer settings → Personal access tokens**. Use a **fine-grained** PAT with read access to **Contents** + **Pull requests** on target repos, or a **classic** PAT with `repo` (private) / minimal read for public. Callers never send this token — only your server reads it. |

The same token powers **richer automated reviews** in this repo: `getPullRequestDiff` also loads changed files, submitted reviews, inline review comments, and issue-thread comments (capped in size) so the LLM prompt is not limited to the raw diff alone.

### MCP servers (Cursor / Claude Desktop) — [`.github/mcp.json`](../.github/mcp.json)

The canonical MCP config lives in **`.github/mcp.json`** (versioned with the repo). It defines:

| Server | Purpose |
|--------|---------|
| **`github`** | Official [GitHub MCP Server](https://github.com/github/github-mcp-server) (Docker `ghcr.io/github/github-mcp-server`). **`GITHUB_PERSONAL_ACCESS_TOKEN`** ← **`${env:GITHUB_READ_TOKEN}`**. |
| **`zyndai`** | [ZyndAI MCP Server](https://github.com/zyndai/mcp-server) (`npx -y zyndai-mcp-server@latest`) — AgentDNS search, get agent cards, **`zyndai_call_agent`**, persona registration, inbox tools. Uses **`ZYNDAI_PERSONA_PUBLIC_URL`** ← **`${env:ZYND_ENTITY_URL}`** so the same public tunnel URL as the repo’s Zynd agent works when set. Optional **`${env:ZYNDAI_PAYMENT_PRIVATE_KEY}`** for paid agent calls (x402). |

**Cursor** loads project MCP from **`.cursor/mcp.json`**, not `.github/` automatically. After cloning, either:

- Copy: `cp .github/mcp.json .cursor/mcp.json` (create `.cursor` if needed), or  
- Merge the top-level **`mcpServers`** object from `.github/mcp.json` into your global **`~/.cursor/mcp.json`**.

Then restart Cursor → **Settings → Tools & MCP** and confirm **github** and **zyndai** are healthy.

**GitHub MCP:** Docker must be running; **`GITHUB_READ_TOKEN`** must be visible to Cursor (export before launch or OS env). Hosted alternative (no Docker): [GitHub install guide for Cursor](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-cursor.md).

**Zynd MCP:** Node 20+; **`npx`** pulls `zyndai-mcp-server@latest`. For **`zyndai_register_persona`**, run a tunnel to the persona webhook port (see [upstream README](https://github.com/zyndai/mcp-server)) and set **`ZYND_ENTITY_URL`** / **`ZYNDAI_PERSONA_PUBLIC_URL`** accordingly. Discovery-only (**search / get / call**) does not require a public persona URL.

## Optional public RAG (off by default)

| Variable | Effect |
|----------|--------|
| **`ENABLE_PUBLIC_RAG`** | Set to **`true`** so the agent may call Pinecone when the client sends **`use_rag: true`**. Otherwise RAG is skipped on the public path. |
| **`PINECONE_DB_API_KEY`** | Same as the Next app — required if public RAG is enabled. |
| **`PINECONE_ENVIRONMENT`** | If your Pinecone client still needs it (see [`lib/pinecone.ts`](../lib/pinecone.ts)). |

## Postman / `webhook/sync` (example)

Sync invoke URL: **`POST {{ZYND_ENTITY_URL}}/webhook/sync`**

Body (JSON) — PR URL plus optional user question (both are honored):

```json
{
  "github_url": "https://github.com/owner/repo/pull/42",
  "prompt": "Does this PR introduce any auth bypass risk?",
  "extra_instructions": "Also comment on test coverage.",
  "use_rag": false
}
```

`prompt` / `content` and `extra_instructions` are combined into the same review request when a `github_url` (or `title`+`diff`) is present.

Alternative: put the same object JSON **string** into **`content`** (Zynd copies it to `prompt`/`content`); the agent will merge it when `github_url` is absent from top-level keys.

**Timeout:** the SDK’s sync path is limited (on the order of **30 seconds**). Very large PRs may time out — use a smaller PR for demos or the async webhook + poll flow from the [zyndai README](https://github.com/zyndai/zyndai-ts-sdk).

## Inngest (unchanged)

The dashboard PR review flow still uses the user’s GitHub OAuth token from the database — **`GITHUB_READ_TOKEN`** is **only** for the standalone Zynd agent process.

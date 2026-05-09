# Copilot instructions for this repository

## Build, lint, and test commands

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build production bundle: `npm run build`
- Start production server: `npm run start`
- Lint the project: `npm run lint`
- Single-test command: no test runner is currently configured in `package.json`, and there are no `*.test.*`/`*.spec.*` files yet.

## High-level architecture

- This is a Next.js 16 app using the App Router (`app/`), TypeScript, and React 19.
- `app/layout.tsx` is the root layout. It imports global styles, loads Geist fonts with `next/font/google`, sets HTML/body shell classes, and defines global `metadata`.
- `app/page.tsx` is the current home route (`/`) and renders the starter UI.
- `app/globals.css` is the global stylesheet. It uses Tailwind CSS v4 via `@import "tailwindcss"` and defines theme tokens (`--background`, `--foreground`, font CSS vars) consumed by Tailwind utility classes.
- PostCSS is configured in `postcss.config.mjs` with `@tailwindcss/postcss`.
- TS path alias `@/*` maps to project root (`tsconfig.json`), so prefer absolute imports via `@/…` when adding shared modules.

## Key conventions in this codebase

- Treat framework behavior as Next.js 16-specific. Before implementing non-trivial framework changes, consult docs in `node_modules/next/dist/docs/` (mirrors existing `CLAUDE.md`/`AGENTS.md` guidance).
- Keep top-level routing and layout in App Router conventions (`app/layout.tsx`, route files under `app/`).
- Keep global design tokens in `app/globals.css` and use Tailwind classes in components; avoid ad-hoc styling systems.
- Follow existing ESLint setup (`eslint.config.mjs`) based on `eslint-config-next/core-web-vitals` plus TypeScript rules.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🧠 Project Context: Stitch

## 🎯 Overview
Stitch is a modern web application built with **Next.js 16.2.3** featuring a distinct "Retro" design aesthetic (RetroUI). This document serves as the persistent memory and context anchor for AI coding agents to maintain deep project understanding, even across context window limits or fragmented sessions.

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

## 📜 Standard Operating Procedures (SOP) for AI Agents
1. **Never Break Tailwind v4 Rules:** All design token extensions (adding new colors, font maps, shadows) MUST be done inside the `@theme` block of `app/globals.css`.
2. **Component Triage:** Before building a new UI element interactively, first verify if an existing module serves the purpose inside `components/retroui/`. Re-use and compose.
3. **shadcn/ui CLI:** If you need a Radix primitive or standard UI element that doesn't exist, recommend the `npx shadcn@latest add <component>` CLI command.
4. **Style Consistency:** Do not use `rounded-md`, soft drop shadows, or standard modern web styling tropes. Keep things flat, sharp-edged, high-contrast, and "retro" branded.

## 🕰️ Development History Log
- **Phase 1 (Initialization):** Scaffolded base Next.js 16.2.3 app with Tailwind v4 and React 19.
- **Phase 2 (Design Setup):**
  - Applied Archivo Black and Space Grotesk mapping globally via `app/layout.tsx`.
  - Replaced the default CSS theme loop with custom RetroUI variables in `globals.css` (`@theme`, `:root`, `.dark`).
- **Phase 3 (Tailwind v4 Fixs):**
  - Resolved a fatal `outline-ring/50` evaluation build error in Tailwind CSS v4. The error was fixed by explicitly defining `--color-ring` in `@theme` and mapping `--ring` tokens inside `:root`/`.dark` to ensure legacy standard classes compiled correctly.

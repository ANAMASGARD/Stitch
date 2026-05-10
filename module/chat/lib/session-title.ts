const MAX_TITLE_LEN = 60;

/** Deterministic chat title from first user message (no LLM). */
export function buildChatSessionTitleFromFirstUserMessage(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return "New chat";
  if (collapsed.length <= MAX_TITLE_LEN) return collapsed;
  const slice = collapsed.slice(0, MAX_TITLE_LEN);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 24) return `${slice.slice(0, lastSpace)}…`;
  return `${slice.trimEnd()}…`;
}

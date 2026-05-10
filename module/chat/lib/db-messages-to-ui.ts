import type { UIMessage } from "ai";

export type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  clientMessageId: string | null;
};

export function dbMessagesToUIMessages(rows: ChatMessageRow[]): UIMessage[] {
  return rows.map((row) => ({
    id: row.clientMessageId ?? row.id,
    role: row.role as UIMessage["role"],
    parts: [{ type: "text" as const, text: row.content }],
  }));
}

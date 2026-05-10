"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from "ai";
import { nanoid } from "nanoid";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useRepositoryChat(options: {
  repositoryId: string | null;
  sessionId: string | null;
}) {
  const { repositoryId, sessionId } = options;
  const chatIdRef = useRef(nanoid());
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        credentials: "include",
        prepareSendMessagesRequest: ({
          id,
          messages: msgs,
          body,
          trigger,
          messageId,
        }) => ({
          body: {
            ...body,
            id,
            messages: msgs,
            trigger,
            messageId,
            repositoryId,
            sessionId,
          },
        }),
      }),
    [repositoryId, sessionId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      if (!repositoryId || !sessionId || !text.trim()) return;
      if (status !== "ready") return;
      setError(undefined);
      const userMessage: UIMessage = {
        id: nanoid(),
        role: "user",
        parts: [{ type: "text", text: text.trim() }],
      };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setStatus("submitted");
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const stream = await transport.sendMessages({
          chatId: chatIdRef.current,
          messages: nextMessages,
          abortSignal: ac.signal,
          trigger: "submit-message",
          messageId: undefined,
          body: {
            repositoryId,
            sessionId,
          },
        });

        setStatus("streaming");
        for await (const msg of readUIMessageStream({
          stream,
          onError: (err) => console.error("[useRepositoryChat] stream", err),
        })) {
          setMessages((prev) => {
            const others = prev.filter((m) => m.id !== msg.id);
            return [...others, msg];
          });
        }
        setStatus("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setStatus("ready");
          return;
        }
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, repositoryId, sessionId, status, transport],
  );

  const replaceMessages = useCallback((next: UIMessage[]) => {
    setMessages(next);
  }, []);

  return {
    messages,
    setMessages: replaceMessages,
    sendText,
    stop,
    status,
    error,
    clearError: () => setError(undefined),
  };
}

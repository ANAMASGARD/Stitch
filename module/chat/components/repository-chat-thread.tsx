"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCirclePlus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Badge } from "@/components/retroui/Badge";
import { getChatMessagesForSession } from "@/module/chat/actions";
import { dbMessagesToUIMessages } from "@/module/chat/lib/db-messages-to-ui";
import { useRepositoryChat } from "@/module/chat/hooks/use-repository-chat";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

const neoShell =
  "rounded-xl border-2 border-black bg-card shadow-[6px_6px_0_0_#000] dark:border-white dark:shadow-[6px_6px_0_0_#fff]";
const neoInput =
  "rounded-xl border-2 border-black bg-background shadow-[4px_4px_0_0_#000] dark:border-white dark:shadow-[4px_4px_0_0_#fff]";

type Props = {
  repositoryId: string;
  sessionId: string;
  sessionTitle: string;
  repoFullName: string;
  /** First message to send after the empty session loads (from hero composer). */
  initialSendText?: string | null;
  onInitialSendConsumed?: () => void;
};

export function RepositoryChatThread({
  repositoryId,
  sessionId,
  sessionTitle,
  repoFullName,
  initialSendText,
  onInitialSendConsumed,
}: Props) {
  const queryClient = useQueryClient();
  const initialSendStarted = useRef(false);

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => getChatMessagesForSession(sessionId),
  });

  const {
    messages,
    setMessages,
    sendText,
    stop,
    status,
    error,
    clearError,
  } = useRepositoryChat({
    repositoryId,
    sessionId,
  });

  useEffect(() => {
    initialSendStarted.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (messagesQuery.isSuccess && messagesQuery.data) {
      setMessages(dbMessagesToUIMessages(messagesQuery.data));
    }
  }, [messagesQuery.isSuccess, messagesQuery.data, setMessages]);

  useEffect(() => {
    const text = initialSendText?.trim();
    if (!text || !onInitialSendConsumed) return;
    if (!messagesQuery.isSuccess) return;
    if ((messagesQuery.data?.length ?? 0) > 0) {
      onInitialSendConsumed();
      return;
    }
    if (initialSendStarted.current) return;
    initialSendStarted.current = true;
    void sendText(text).finally(() => {
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions", repositoryId] });
      onInitialSendConsumed();
    });
  }, [
    initialSendText,
    messagesQuery.isSuccess,
    messagesQuery.data,
    onInitialSendConsumed,
    queryClient,
    repositoryId,
    sendText,
  ]);

  const handleSend = useCallback(
    async (msg: { text: string }) => {
      clearError();
      await sendText(msg.text);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions", repositoryId] });
    },
    [clearError, queryClient, repositoryId, sendText],
  );

  const renderMessage = (m: UIMessage) => {
    const text = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    if (!text) return null;
    return (
      <Message from={m.role} key={m.id}>
        <MessageContent
          className={cn(
            m.role === "assistant" &&
              "max-w-full rounded-xl border-2 border-black bg-yellow-50/40 p-4 dark:border-white dark:bg-zinc-900/80",
            m.role === "user" &&
              "rounded-xl! border-2! border-black! bg-primary! px-4 py-3 text-primary-foreground! dark:border-white!",
          )}
        >
          {m.role === "assistant" ? (
            <MessageResponse className="text-sm leading-relaxed">{text}</MessageResponse>
          ) : (
            <p className="text-sm whitespace-pre-wrap text-inherit">{text}</p>
          )}
        </MessageContent>
      </Message>
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", neoShell)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-black px-4 py-3 dark:border-white">
        <div className="min-w-0">
          <h3 className="truncate font-head text-base font-semibold">{sessionTitle}</h3>
          <p className="truncate font-mono text-xs text-muted-foreground">{repoFullName}</p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 rounded-md border-2 border-black font-head text-[10px] uppercase tracking-wide dark:border-white"
        >
          {status === "streaming" || status === "submitted" ? "Thinking…" : "Ready"}
        </Badge>
      </div>

      {error ? (
        <div className="border-b-2 border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      <Conversation className="min-h-[200px] flex-1 border-0 bg-muted/15">
        <ConversationContent className="gap-6 pb-2">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask anything"
              description="Your question is embedded and matched against this repository’s index."
              className="text-muted-foreground [&_h3]:text-foreground"
              icon={<MessageCirclePlus className="size-10 text-muted-foreground/60" />}
            />
          ) : (
            messages.map((m) => renderMessage(m))
          )}
        </ConversationContent>
        <ConversationScrollButton className="border-2 border-black dark:border-white" />
      </Conversation>

      <div className="shrink-0 p-3 pt-1 md:p-4 md:pt-2">
        <PromptInput onSubmit={handleSend} className={neoInput}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={`Message ${repoFullName}…`}
              disabled={status !== "ready"}
              className="min-h-[52px] border-0 bg-transparent focus-visible:ring-0 md:min-h-[60px]"
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end border-t-2 border-black/10 px-3 pb-3 pt-2 dark:border-white/15">
            <PromptInputSubmit
              status={
                status === "error"
                  ? "error"
                  : status === "streaming"
                    ? "streaming"
                    : status === "submitted"
                      ? "submitted"
                      : "ready"
              }
              onStop={stop}
              className="rounded-md border-2 border-black dark:border-white"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

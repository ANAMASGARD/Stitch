"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Menu, MessageCirclePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/retroui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Command } from "@/components/retroui/Command";
import { Drawer } from "@/components/retroui/Drawer";
import { Loader } from "@/components/retroui/Loader";
import { Popover } from "@/components/retroui/Popover";
import { Tooltip } from "@/components/retroui/Tooltip";
import {
  createChatSession,
  deleteChatSession,
  getChatSessionsForRepository,
  getConnectedRepositoriesForChat,
} from "@/module/chat/actions";
import { RepositoryChatThread } from "@/module/chat/components/repository-chat-thread";
import { cn } from "@/lib/utils";

const neoCard =
  "rounded-xl border-2 border-black bg-card shadow-[6px_6px_0_0_#000] dark:border-white dark:shadow-[6px_6px_0_0_#fff]";
const neoInset = "rounded-xl border-2 border-black bg-muted/40 dark:border-white";

export function RepositoryChatDashboard() {
  const queryClient = useQueryClient();
  const [manualRepoId, setManualRepoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [threadsDrawerOpen, setThreadsDrawerOpen] = useState(false);
  const [pendingInitialText, setPendingInitialText] = useState<string | null>(null);

  const reposQuery = useQuery({
    queryKey: ["chat-repositories"],
    queryFn: getConnectedRepositoriesForChat,
  });

  const repos = useMemo(() => reposQuery.data ?? [], [reposQuery.data]);
  const selectedRepoId = manualRepoId ?? repos[0]?.id ?? null;

  const sessionsQuery = useQuery({
    queryKey: ["chat-sessions", selectedRepoId],
    queryFn: () => getChatSessionsForRepository(selectedRepoId!),
    enabled: Boolean(selectedRepoId),
  });

  const selectedRepo = useMemo(
    () => repos.find((r) => r.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const sessionTitle =
    sessionsQuery.data?.find((s) => s.id === sessionId)?.title ?? "Chat";

  const newSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepoId) throw new Error("No repository");
      return createChatSession(selectedRepoId);
    },
    onSuccess: (row) => {
      setSessionId(row.id);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions", selectedRepoId] });
      setThreadsDrawerOpen(false);
    },
  });

  const startWithMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedRepoId) throw new Error("No repository");
      const row = await createChatSession(selectedRepoId);
      return { row, text: text.trim() };
    },
    onSuccess: ({ row, text }) => {
      setSessionId(row.id);
      setPendingInitialText(text);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions", selectedRepoId] });
      setThreadsDrawerOpen(false);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      setSessionId(null);
      setPendingInitialText(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions", selectedRepoId] });
    },
  });

  if (reposQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">Repository chat</h1>
          <p className="text-muted-foreground">
            Connect a repository to ask questions about its codebase using indexed context.
          </p>
        </div>
        <Card className={cn("max-w-lg", neoCard)}>
          <CardHeader>
            <CardTitle>No repositories connected</CardTitle>
            <CardDescription>
              Stitch indexes connected repos into Pinecone so answers stay grounded in your code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-md" variant="default">
              <Link href="/dashboard/repositories">Connect a repository</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const heroBusy =
    newSessionMutation.isPending || startWithMessageMutation.isPending;
  const heroError =
    (newSessionMutation.error as Error | undefined)?.message ??
    (startWithMessageMutation.error as Error | undefined)?.message;

  return (
    <div
      className={cn(
        "relative flex min-h-[min(100dvh,920px)] flex-col overflow-hidden",
        neoCard,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-black px-4 py-3 md:px-5 dark:border-white">
        <div className="min-w-0">
          <p className="font-head text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Repository chat
          </p>
          <p className="truncate font-mono text-sm font-medium">
            {selectedRepo?.fullName ?? "Choose a repository"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Popover open={repoPickerOpen} onOpenChange={setRepoPickerOpen}>
            <Popover.Trigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md border-2 border-black shadow-[3px_3px_0_0_#000] dark:border-white dark:shadow-[3px_3px_0_0_#fff]"
              >
                <GitBranch className="mr-1.5 size-4 shrink-0" />
                <span className="max-w-[140px] truncate sm:max-w-[200px]">
                  {selectedRepo ? selectedRepo.fullName : "Repo"}
                </span>
              </Button>
            </Popover.Trigger>
            <Popover.Content
              align="end"
              className="w-[min(100vw-2rem,420px)] border-2 border-black p-0 dark:border-white"
            >
              <Command className="border-0 shadow-none">
                <Command.Input placeholder="Search repositories…" />
                <Command.List>
                  <Command.Empty>No match.</Command.Empty>
                  <Command.Group heading="Connected">
                    {repos.map((r) => (
                      <Command.Item
                        key={r.id}
                        value={r.fullName}
                        onSelect={() => {
                          setManualRepoId(r.id);
                          setSessionId(null);
                          setPendingInitialText(null);
                          setRepoPickerOpen(false);
                        }}
                      >
                        <span className="font-medium">{r.fullName}</span>
                        {r.id === selectedRepoId ? <Command.Check /> : null}
                      </Command.Item>
                    ))}
                  </Command.Group>
                </Command.List>
              </Command>
            </Popover.Content>
          </Popover>

          {selectedRepoId ? (
            <Drawer
              direction="right"
              open={threadsDrawerOpen}
              onOpenChange={setThreadsDrawerOpen}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Past chats"
                className="size-10 shrink-0 rounded-md border-2 border-black shadow-[3px_3px_0_0_#000] dark:border-white dark:shadow-[3px_3px_0_0_#fff]"
                onClick={() => setThreadsDrawerOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              <Drawer.Content
                className={cn(
                  "flex max-h-dvh min-h-full flex-col border-l-2 border-black bg-card sm:max-w-sm dark:border-white",
                )}
              >
                <Drawer.Header className="border-b-2 border-black text-left dark:border-white">
                  <Drawer.Title className="text-lg">Past chats</Drawer.Title>
                  <Drawer.Description>Saved threads for this repository</Drawer.Description>
                </Drawer.Header>
                <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-md border-2 border-black font-head dark:border-white"
                    onClick={() => newSessionMutation.mutate()}
                    disabled={newSessionMutation.isPending}
                  >
                    {newSessionMutation.isPending ? (
                      <Loader size="sm" className="mr-2" />
                    ) : (
                      <MessageCirclePlus className="mr-2 size-4" />
                    )}
                    New chat
                  </Button>
                  {newSessionMutation.isError ? (
                    <p className="rounded-md border-2 border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {(newSessionMutation.error as Error)?.message ??
                        "Could not start a chat."}
                    </p>
                  ) : null}
                  {sessionsQuery.isLoading ? (
                    <div className="flex flex-1 items-center justify-center py-10">
                      <Loader size="md" />
                    </div>
                  ) : (
                    <Tooltip.Provider delayDuration={200}>
                      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
                        {(sessionsQuery.data ?? []).map((s) => (
                          <li key={s.id}>
                            <Tooltip>
                              <Tooltip.Trigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPendingInitialText(null);
                                    setSessionId(s.id);
                                    setThreadsDrawerOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full items-center rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors",
                                    sessionId === s.id
                                      ? "border-black bg-primary font-head dark:border-white"
                                      : "border-transparent hover:border-black/30 hover:bg-muted/80 dark:hover:border-white/30",
                                  )}
                                >
                                  <span className="line-clamp-2">{s.title}</span>
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Content side="left" className="max-w-[240px] text-xs">
                                {s.title}
                              </Tooltip.Content>
                            </Tooltip>
                          </li>
                        ))}
                      </ul>
                    </Tooltip.Provider>
                  )}
                  {sessionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-auto w-full rounded-md border-2 border-destructive text-destructive shadow-[3px_3px_0_0_rgb(220,38,38)]"
                      onClick={() => {
                        if (confirm("Delete this chat thread?")) {
                          deleteSessionMutation.mutate(sessionId);
                        }
                      }}
                      disabled={deleteSessionMutation.isPending}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete current thread
                    </Button>
                  ) : null}
                </div>
              </Drawer.Content>
            </Drawer>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
        {!selectedRepoId ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-center text-sm text-muted-foreground">
              Use the repository picker above to choose a project.
            </p>
          </div>
        ) : !sessionId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 md:py-14">
            <div className="max-w-2xl space-y-2 text-center">
              <h2 className="font-head text-3xl font-semibold tracking-tight md:text-4xl">
                Where should we begin?
              </h2>
              <p className="text-sm text-muted-foreground md:text-base">
                Type a question below — we create a thread and stream an answer using vector search
                over <span className="font-mono font-medium">{selectedRepo?.fullName}</span>.
              </p>
            </div>

            <div className="w-full max-w-3xl">
              <div className={cn("p-4 md:p-5", neoInset)}>
                <p className="mb-3 font-head text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ask anything
                </p>
                <PromptInput
                  onSubmit={async (msg) => {
                    const t = msg.text.trim();
                    if (!t || heroBusy) return;
                    await startWithMessageMutation.mutateAsync(t);
                  }}
                  className={cn(
                    "rounded-xl border-2 border-black bg-card shadow-[4px_4px_0_0_#000] dark:border-white dark:shadow-[4px_4px_0_0_#fff]",
                  )}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      placeholder={`Message ${selectedRepo?.fullName ?? "repo"}…`}
                      disabled={heroBusy}
                      className="min-h-[72px] border-0 bg-transparent focus-visible:ring-0 md:min-h-[88px]"
                    />
                  </PromptInputBody>
                  <PromptInputFooter className="justify-between gap-2 border-t-2 border-black/10 px-3 pb-3 pt-2 dark:border-white/15">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md border-2 border-black text-xs dark:border-white"
                      onClick={() => newSessionMutation.mutate()}
                      disabled={heroBusy}
                    >
                      {newSessionMutation.isPending ? (
                        <Loader size="sm" className="mr-2" />
                      ) : (
                        <MessageCirclePlus className="mr-2 size-4" />
                      )}
                      Empty thread
                    </Button>
                    <PromptInputSubmit
                      status={heroBusy ? "submitted" : "ready"}
                      className="rounded-md border-2 border-black dark:border-white"
                    />
                  </PromptInputFooter>
                </PromptInput>
                {heroError ? (
                  <p className="mt-3 text-center text-sm text-destructive">{heroError}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : selectedRepoId && sessionId && selectedRepo ? (
          <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
            <RepositoryChatThread
              key={sessionId}
              repositoryId={selectedRepoId}
              sessionId={sessionId}
              sessionTitle={sessionTitle}
              repoFullName={selectedRepo.fullName}
              initialSendText={pendingInitialText}
              onInitialSendConsumed={() => setPendingInitialText(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

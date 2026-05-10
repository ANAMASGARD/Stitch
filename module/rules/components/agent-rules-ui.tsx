"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Textarea } from "@/components/retroui/Textarea";
import { Label } from "@/components/retroui/Label";
import { Select } from "@/components/retroui/Select";
import { Loader } from "@/components/retroui/Loader";
import { getConnectedRepositoriesForChat } from "@/module/chat/actions";
import { cn } from "@/lib/utils";

type DraftRule = {
  id: string;
  title: string;
  body: string;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const shell =
  "rounded-lg border-2 border-black bg-card shadow-[3px_3px_0_0_#000] dark:border-white dark:shadow-[3px_3px_0_0_#fff]";

export function AgentRulesUi() {
  const reposQuery = useQuery({
    queryKey: ["chat-repositories"],
    queryFn: getConnectedRepositoriesForChat,
  });

  const repos = useMemo(() => reposQuery.data ?? [], [reposQuery.data]);
  const [manualRepoId, setManualRepoId] = useState<string | null>(null);

  const selectedRepoId = useMemo(() => {
    if (manualRepoId && repos.some((r) => r.id === manualRepoId)) return manualRepoId;
    return repos[0]?.id ?? "";
  }, [manualRepoId, repos]);

  const selectedRepo = useMemo(
    () => repos.find((r) => r.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const [rules, setRules] = useState<DraftRule[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const canAdd = useMemo(() => body.trim().length > 0, [body]);

  const addRule = useCallback(() => {
    if (!canAdd) return;
    const trimmedTitle = title.trim() || "Untitled rule";
    setRules((prev) => [
      { id: newId(), title: trimmedTitle, body: body.trim() },
      ...prev,
    ]);
    setTitle("");
    setBody("");
  }, [body, canAdd, title]);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setRules([]);
  }, []);

  if (reposQuery.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (reposQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="space-y-1">
          <h1 className="font-head text-2xl font-black uppercase tracking-tight text-black dark:text-white">
            Agent rules
          </h1>
        </header>
        <Card className={cn("w-full", shell)}>
          <CardHeader>
            <CardTitle className="text-base">Could not load repositories</CardTitle>
            <CardDescription>Check your connection and try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-black dark:border-white"
              onClick={() => void reposQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="space-y-1">
          <h1 className="font-head text-2xl font-black uppercase tracking-tight text-black dark:text-white">
            Agent rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Short instructions agents should follow for this codebase.
          </p>
        </header>
        <Card className={cn("w-full max-w-lg", shell)}>
          <CardHeader>
            <CardTitle>No repositories connected</CardTitle>
            <CardDescription>
              Connect a repository to scope rules to a codebase — same list as repository chat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="border-2 border-black dark:border-white">
              <Link href="/dashboard/repositories">Connect a repository</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <header className="min-w-0 flex-1 space-y-1">
          <h1 className="font-head text-2xl font-black uppercase tracking-tight text-black dark:text-white">
            Agent rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Short instructions agents should follow for this codebase.
          </p>
        </header>

        <div
          className={cn(
            "flex w-full shrink-0 flex-col gap-1 rounded-lg border-2 border-black bg-[#fdfaf2] p-2.5 shadow-[3px_3px_0_0_#000] dark:border-white dark:bg-zinc-900 dark:shadow-[3px_3px_0_0_#fff]",
            "sm:w-auto sm:min-w-44",
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Codebase
          </span>
          <Select value={selectedRepoId} onValueChange={(id) => setManualRepoId(id)}>
            <Select.Trigger
              className={cn(
                "h-8 min-h-8 border-2 border-black bg-white py-1 text-xs font-semibold dark:border-white dark:bg-zinc-950",
                "w-full sm:max-w-56",
              )}
              aria-label="Select connected repository"
            >
              <Select.Value placeholder="Repository" />
            </Select.Trigger>
            <Select.Content className="border-2 border-black dark:border-white">
              {repos.map((r) => (
                <Select.Item key={r.id} value={r.id} className="text-xs">
                  {r.fullName}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      <Card className={cn("w-full", shell)}>
        <CardHeader className="space-y-1 border-b-2 border-black px-4 py-3 dark:border-white">
          <CardTitle className="text-base font-black uppercase">New rule</CardTitle>
          <CardDescription className="text-xs">Title optional — rule text is required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-title" className="text-[11px] font-bold uppercase text-muted-foreground">
              Title
            </Label>
            <Input
              id="rule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naming convention, UI stack, …"
              className="rounded-md border-2 border-black py-2 text-sm dark:border-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-body" className="text-[11px] font-bold uppercase text-muted-foreground">
              Rule
            </Label>
            <Textarea
              id="rule-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What should agents do or avoid?"
              rows={3}
              className="min-h-[88px] resize-y rounded-md border-2 border-black py-2 text-sm dark:border-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="md"
              disabled={!canAdd}
              onClick={addRule}
              className="gap-1.5 border-2 border-black px-4 font-head text-sm uppercase dark:border-white"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden />
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={rules.length === 0}
              onClick={clearAll}
              className="border-2 border-black text-sm dark:border-white"
            >
              Clear all
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-head text-xs font-black uppercase tracking-widest text-muted-foreground">
            Rules · {rules.length}
          </h2>
          {selectedRepo ? (
            <span className="font-mono text-[11px] font-semibold text-foreground/80">
              {selectedRepo.fullName}
            </span>
          ) : null}
        </div>

        {rules.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-black/25 px-3 py-6 text-center text-sm text-muted-foreground dark:border-white/25">
            None yet — add one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((rule) => (
              <li key={rule.id}>
                <Card className={cn("w-full", shell)}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-head text-sm font-black text-black dark:text-white">
                          {rule.title}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-snug text-muted-foreground">
                          {rule.body}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(rule.id)}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${rule.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

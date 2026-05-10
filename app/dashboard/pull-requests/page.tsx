"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, GitBranch, User } from "lucide-react";
import { parseStoredStitchIssueFixPlan } from "@/module/ai/lib/issue-to-pr-llm";
import { getStitchPullRequests } from "@/module/pull-request/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { Button } from "@/components/retroui/Button";
import { Loader } from "@/components/retroui/Loader";

type StitchPrRow = Awaited<ReturnType<typeof getStitchPullRequests>>[number];

const STATUS_BADGE_CLASS: Record<string, string> = {
  pr_opened: "bg-yellow-500 text-black border-black",
  failed: "bg-red-500 text-white border-black",
  planning: "bg-blue-100 text-blue-900 border-black",
  branch_created: "bg-blue-200 text-blue-900 border-black",
  files_written: "bg-blue-300 text-blue-900 border-black",
  skipped_insufficient_context: "bg-gray-200 text-gray-800 border-black",
};

function statusBadgeClass(status: string): string {
  return (
    STATUS_BADGE_CLASS[status] ??
    "bg-muted text-foreground border-black"
  );
}

export default function PullRequestsPage() {
  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ["stitch-pull-requests"],
    queryFn: async () => await getStitchPullRequests(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">
            Pull requests
          </h1>
          <p className="text-muted-foreground">
            Pull requests opened by Stitch from <code className="rounded bg-muted px-1">/stitch fix</code>
          </p>
        </div>
        <div className="flex h-56 items-center justify-center">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">
            Pull requests
          </h1>
          <p className="text-muted-foreground">
            Pull requests opened by Stitch from <code className="rounded bg-muted px-1">/stitch fix</code>
          </p>
        </div>
        <Card className="w-full rounded-xl border-black">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load pull requests</CardTitle>
            <CardDescription>
              {(error as Error)?.message || "An unexpected error occurred."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-head">
          Pull requests
        </h1>
        <p className="text-muted-foreground">
          Pull requests opened by Stitch from <code className="rounded bg-muted px-1">/stitch fix</code>{" "}
          on your connected repositories.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="w-full rounded-xl border-black">
          <CardHeader>
            <CardTitle>No pull requests yet</CardTitle>
            <CardDescription>
              When a collaborator runs <code className="rounded bg-muted px-1">/stitch fix</code> on an issue,
              Stitch will open a PR here once the run completes.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((row: StitchPrRow) => {
            const plan = parseStoredStitchIssueFixPlan(row.planJson);
            return (
              <Card
                key={row.id}
                className="w-full overflow-hidden rounded-xl border-black bg-card shadow-[6px_6px_0px_0px_var(--color-yellow-500)]"
              >
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="mb-0 text-lg">
                          {row.repository.fullName}
                          {row.prNumber != null ? ` · PR #${row.prNumber}` : ""}
                        </CardTitle>
                        <Badge
                          className={`rounded-md border-2 ${statusBadgeClass(row.status)}`}
                          variant="outline"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          Stitch AI
                        </span>
                        <span>Issue #{row.issueNumber}</span>
                        {row.branchName ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs">
                            <GitBranch className="h-3.5 w-3.5" />
                            {row.branchName}
                          </span>
                        ) : null}
                        <span>
                          {formatDistanceToNow(new Date(row.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </CardDescription>
                    </div>
                    {row.prUrl ? (
                      <Button className="rounded-md shrink-0" variant="outline" size="sm" asChild>
                        <a href={row.prUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open PR
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {row.failureReason ? (
                    <div className="rounded-lg border-2 border-red-500 bg-red-50/30 p-3 text-sm text-destructive dark:bg-red-950/20">
                      {row.failureReason}
                    </div>
                  ) : null}

                  {plan ? (
                    <div className="rounded-lg border-2 border-black/15 bg-yellow-50/20 p-4 dark:bg-yellow-950/10">
                      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                        Plan
                      </h3>
                      <p className="text-sm font-medium text-foreground">{plan.summary}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{plan.approach}</p>
                      {plan.files.length > 0 ? (
                        <ul className="mt-3 space-y-1.5 text-sm">
                          {plan.files.map((f) => (
                            <li
                              key={`${row.id}-${f.path}-${f.action}`}
                              className="flex flex-wrap items-baseline gap-2 border-t border-black/10 pt-1.5 first:border-t-0 first:pt-0"
                            >
                              <Badge variant="outline" className="rounded-md text-xs">
                                {f.action}
                              </Badge>
                              <code className="text-xs font-mono">{f.path}</code>
                              <span className="text-muted-foreground line-clamp-2">
                                {f.changeDescription}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : row.planJson ? (
                    <p className="text-sm text-muted-foreground">
                      Plan details unavailable (stored plan could not be parsed).
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

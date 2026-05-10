import { randomBytes } from "node:crypto";
import { inngest } from "../client";
import prisma from "@/lib/db";
import { hasStitchFixCommand } from "@/lib/stitch-github-commands";
import { retrieveContext } from "@/module/ai/lib/rag";
import type { IssueFixPlan } from "@/module/ai/lib/issue-to-pr-llm";
import {
  analyzeIssueAgainstCodebase,
  formatIssueRagContext,
  generateIssueFileContent,
  isPathBlockedForIssueAutomation,
  MAX_AUTO_PR_FILE_CHARS,
  MAX_AUTO_PR_FILES,
  planIssueFix,
} from "@/module/ai/lib/issue-to-pr-llm";
import {
  createBranchFromDefault,
  createOrUpdateRepoFile,
  createPullRequest,
  deleteRepoFile,
  getCollaboratorPermissionLevel,
  getDefaultBranch,
  getIssue,
  getRepoFileContentWithSha,
  postIssueComment,
} from "@/module/github/lib/github";

const MIN_CONTEXT_CHUNKS = 3;
const RAG_TOP_K = 8;

const WRITE_PERMISSIONS = new Set(["admin", "maintain", "write"]);

async function loadGithubTokenForUser(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
  });
  return account?.accessToken ?? null;
}

export const analyzeIssue = inngest.createFunction(
  {
    id: "analyze-issue",
    concurrency: 5,
    triggers: [{ event: "issue.analysis.requested" }],
  },
  async ({ event, step }) => {
    const { owner, repo, issueNumber, userId, issueTitle, issueUrl, issueBody } =
      event.data as {
        owner: string;
        repo: string;
        issueNumber: number;
        userId: string;
        issueTitle?: string;
        issueUrl?: string;
        issueBody?: string;
      };

    const token = await step.run("load-token", () => loadGithubTokenForUser(userId));
    if (!token) {
      throw new Error("No GitHub access token for issue analysis");
    }

    const repository = await step.run("load-repository", async () => {
      const r = await prisma.repository.findFirst({
        where: { owner, name: repo },
      });
      if (!r) {
        throw new Error(`Repository ${owner}/${repo} not connected`);
      }
      return r;
    });

    const title = issueTitle ?? "";
    const body = issueBody ?? "";

    const chunks = await step.run("retrieve-context", async () => {
      const q = `${title}\n${body}`;
      return retrieveContext(q, `${owner}/${repo}`, RAG_TOP_K);
    });

    if (chunks.length < MIN_CONTEXT_CHUNKS) {
      if (chunks.length === 0) {
        await step.run("queue-reindex-for-triage", async () => {
          await inngest.send({
            id: `repository.connected:reindex-triage:${userId}:${owner}/${repo}`,
            name: "repository.connected",
            data: { owner, repo, userId },
          });
        });
      }
      await step.run("comment-insufficient-context", async () => {
        const reindexNote =
          chunks.length === 0
            ? `\n\n**Stitch AI** queued a full re-index for this repository. Open the Inngest dashboard, wait until the \`index-repo\` run finishes, then add a short comment on this issue to re-run triage.`
            : `\n\nIf you already connected the repo, wait for indexing to finish (\`index-repo\` in Inngest), or disconnect and reconnect on the Stitch dashboard to trigger a new index.`;
        await postIssueComment(
          token,
          owner,
          repo,
          issueNumber,
          `**Stitch AI** could not find enough indexed context in Pinecone for \`${owner}/${repo}\` (found ${chunks.length} chunks; need at least ${MIN_CONTEXT_CHUNKS}). ` +
            `Confirm **Next.js** and **Inngest** are running, your **ngrok** tunnel targets the same port as the app, and **Pinecone** env keys match the index used for chat.` +
            reindexNote,
        );
      });

      await step.run("persist-skip", async () => {
        await prisma.issueAnalysis.upsert({
          where: {
            repositoryId_issueNumber: {
              repositoryId: repository.id,
              issueNumber,
            },
          },
          create: {
            repositoryId: repository.id,
            issueNumber,
            issueTitle: title || null,
            issueUrl: issueUrl ?? null,
            classification: "unknown",
            analysis: "Skipped: insufficient indexed context.",
            contextChunkCount: chunks.length,
            status: "skipped_insufficient_context",
          },
          update: {
            issueTitle: title || null,
            issueUrl: issueUrl ?? null,
            classification: "unknown",
            analysis: "Skipped: insufficient indexed context.",
            contextChunkCount: chunks.length,
            status: "skipped_insufficient_context",
          },
        });
      });

      return { skipped: true as const };
    }

    const triage = await step.run("llm-triage", async () => {
      const contextFromCodebase = formatIssueRagContext(chunks);
      return analyzeIssueAgainstCodebase({
        title,
        body,
        contextFromCodebase,
      });
    });

    await step.run("post-triage-comment", async () => {
      const commentBody =
        `### Stitch AI · Issue triage\n\n${triage.commentMarkdown}\n\n` +
        `—\n_Classification: **${triage.classification}** · Powered by Stitch AI_`;
      await postIssueComment(token, owner, repo, issueNumber, commentBody);
    });

    await step.run("persist-analysis", async () => {
      await prisma.issueAnalysis.upsert({
        where: {
          repositoryId_issueNumber: {
            repositoryId: repository.id,
            issueNumber,
          },
        },
        create: {
          repositoryId: repository.id,
          issueNumber,
          issueTitle: title || null,
          issueUrl: issueUrl ?? null,
          classification: triage.classification,
          analysis: triage.commentMarkdown,
          contextChunkCount: chunks.length,
          status: "completed",
        },
        update: {
          issueTitle: title || null,
          issueUrl: issueUrl ?? null,
          classification: triage.classification,
          analysis: triage.commentMarkdown,
          contextChunkCount: chunks.length,
          status: "completed",
        },
      });
    });

    return { success: true };
  }
);

export const createIssueFixPullRequest = inngest.createFunction(
  {
    id: "create-issue-fix-pr",
    concurrency: 3,
    triggers: [{ event: "issue.auto_pr.requested" }],
  },
  async ({ event, step }) => {
    const {
      owner,
      repo,
      issueNumber,
      userId,
      commandCommentId,
      commandCommentAuthor,
      commandCommentBody,
    } = event.data as {
      owner: string;
      repo: string;
      issueNumber: number;
      userId: string;
      commandCommentId: string;
      commandCommentAuthor: string;
      commandCommentBody: string;
    };

    const token = await step.run("load-token", () => loadGithubTokenForUser(userId));
    if (!token) {
      throw new Error("No GitHub access token for auto-PR");
    }

    const repository = await step.run("load-repository", async () => {
      const r = await prisma.repository.findFirst({
        where: { owner, name: repo },
      });
      if (!r) {
        throw new Error(`Repository ${owner}/${repo} not connected`);
      }
      return r;
    });

    const markFailed = async (reason: string, comment?: string) => {
      if (comment) {
        try {
          await postIssueComment(token, owner, repo, issueNumber, comment);
        } catch (e) {
          console.error("postIssueComment failed:", e);
        }
      }
      await prisma.autoPullRequest.upsert({
        where: { commandCommentId },
        create: {
          repositoryId: repository.id,
          issueNumber,
          commandCommentId,
          commandCommentAuthor,
          status: "failed",
          failureReason: reason,
        },
        update: {
          status: "failed",
          failureReason: reason,
        },
      });
    };

    const existingDone = await step.run("check-duplicate-pr-for-issue", async () => {
      return prisma.autoPullRequest.findFirst({
        where: {
          repositoryId: repository.id,
          issueNumber,
          status: "pr_opened",
        },
      });
    });

    if (existingDone) {
      await step.run("comment-duplicate-issue-pr", async () => {
        await postIssueComment(
          token,
          owner,
          repo,
          issueNumber,
          `**Stitch AI** already opened a pull request for this issue: ${existingDone.prUrl ?? "(see dashboard)"}. ` +
            `Override flows like \`/stitch fix --again\` are not supported in v1.`,
        );
      });
      return { skipped: "duplicate_issue_pr" as const };
    }

    const existingCommand = await step.run("check-command-idempotency", async () => {
      return prisma.autoPullRequest.findUnique({
        where: { commandCommentId },
      });
    });

    if (existingCommand?.status === "pr_opened") {
      return { skipped: "same_command_done" as const };
    }

    if (!hasStitchFixCommand(commandCommentBody ?? "")) {
      await markFailed(
        "not_stitch_fix_command",
        "**Stitch AI** ignored this run: the triggering comment must contain `/stitch fix`.",
      );
      return { skipped: "no_command" as const };
    }

    const issue = await step.run("fetch-issue", async () => {
      return getIssue(token, owner, repo, issueNumber);
    });

    const permission = await step.run("check-collaborator-permission", async () => {
      return getCollaboratorPermissionLevel(
        token,
        owner,
        repo,
        commandCommentAuthor
      );
    });

    if (!permission || !WRITE_PERMISSIONS.has(permission)) {
      await markFailed(
        "unauthorized",
        `**Stitch AI** cannot run \`/stitch fix\`: the GitHub account that posted the command needs **write**, **maintain**, or **admin** on \`${owner}/${repo}\` (current: **${permission ?? "none"}**).`,
      );
      return { skipped: "unauthorized" as const };
    }

    await step.run("upsert-auto-pr-row", async () => {
      await prisma.autoPullRequest.upsert({
        where: { commandCommentId },
        create: {
          repositoryId: repository.id,
          issueNumber,
          commandCommentId,
          commandCommentAuthor,
          status: "planning",
        },
        update: {
          commandCommentAuthor,
          status: "planning",
          failureReason: null,
        },
      });
    });

    const chunks = await step.run("retrieve-context", async () => {
      const q = `${issue.title}\n${issue.body}`;
      return retrieveContext(q, `${owner}/${repo}`, RAG_TOP_K);
    });

    if (chunks.length < MIN_CONTEXT_CHUNKS) {
      if (chunks.length === 0) {
        await step.run("queue-reindex-for-fix", async () => {
          await inngest.send({
            id: `repository.connected:reindex-fix:${userId}:${owner}/${repo}`,
            name: "repository.connected",
            data: { owner, repo, userId },
          });
        });
      }
      const fixNote =
        chunks.length === 0
          ? `\n\n**Stitch AI** has **queued a full re-index** (\`repository.connected\`). In Inngest, wait until \`index-repo\` completes for \`${owner}/${repo}\`, then comment \`/stitch fix\` again on this issue.`
          : `\n\nConfirm Pinecone has vectors for \`${owner}/${repo}\` (same \`repoId\` as indexing). Run \`index-repo\` again if needed, then retry \`/stitch fix\`.`;
      await markFailed(
        "insufficient_context",
        `**Stitch AI** needs at least ${MIN_CONTEXT_CHUNKS} indexed context chunks to plan a safe change (found ${chunks.length}).` +
          fixNote,
      );
      return { skipped: "insufficient_context" as const };
    }

    const prior = await step.run("load-prior-analysis", async () => {
      return prisma.issueAnalysis.findUnique({
        where: {
          repositoryId_issueNumber: {
            repositoryId: repository.id,
            issueNumber,
          },
        },
      });
    });

    const pathCandidates = await step.run("collect-path-candidates", async () => {
      const paths = new Set<string>();
      for (const c of chunks) {
        if (c.path && !isPathBlockedForIssueAutomation(c.path)) {
          paths.add(c.path);
        }
      }
      return Array.from(paths).slice(0, 20);
    });

    const fileBundle = await step.run("fetch-file-contents-default-branch", async () => {
      const out: Array<{ path: string; content: string }> = [];
      for (const path of pathCandidates) {
        const got = await getRepoFileContentWithSha(token, owner, repo, path);
        if (got) {
          out.push({
            path,
            content: got.content.slice(0, MAX_AUTO_PR_FILE_CHARS),
          });
        }
      }
      return out;
    });

    const planResult = await step.run("llm-plan", async () => {
      try {
        const p = await planIssueFix({
          issueTitle: issue.title,
          issueBody: issue.body,
          contextFromCodebase: formatIssueRagContext(chunks),
          fileContents: fileBundle,
          previousAnalysis: prior?.analysis ?? undefined,
        });
        return { ok: true as const, plan: p };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false as const, error: msg };
      }
    });

    if (!planResult.ok) {
      await markFailed(
        "plan_failed",
        `**Stitch AI** could not build a valid fix plan (JSON / validation). ${planResult.error}`,
      );
      return { skipped: "plan_failed" as const };
    }

    const plan: IssueFixPlan = planResult.plan;

    const filteredFiles = plan.files.filter((f) => !isPathBlockedForIssueAutomation(f.path));
    if (!filteredFiles.length || filteredFiles.length > MAX_AUTO_PR_FILES) {
      await markFailed(
        "bad_plan_files",
        "**Stitch AI** rejected the plan: no allowed file paths after safety filters, or too many files.",
      );
      return { skipped: "bad_plan_files" as const };
    }

    await step.run("persist-plan", async () => {
      await prisma.autoPullRequest.updateMany({
        where: { commandCommentId },
        data: { planJson: JSON.stringify(plan), status: "planning" },
      });
    });

    const shortId = randomBytes(3).toString("hex");
    const branchName = `stitch/issue-${issueNumber}-${shortId}`;

    await step.run("create-branch", async () => {
      await createBranchFromDefault(token, owner, repo, branchName);
      await prisma.autoPullRequest.updateMany({
        where: { commandCommentId },
        data: { branchName, status: "branch_created" },
      });
    });

    const baseBranch = await step.run("get-default-branch", async () =>
      getDefaultBranch(token, owner, repo)
    );

    for (let i = 0; i < filteredFiles.length; i++) {
      const entry = filteredFiles[i]!;
      await step.run(`apply-file-${i}-${entry.path.replace(/[^\w.-]+/g, "_")}`, async () => {
        if (entry.action === "delete") {
          const current = await getRepoFileContentWithSha(
            token,
            owner,
            repo,
            entry.path,
            branchName
          );
          if (!current) {
            throw new Error(`Cannot delete missing file: ${entry.path}`);
          }
          await deleteRepoFile(
            token,
            owner,
            repo,
            entry.path,
            `chore: remove ${entry.path} (stitch/issue-${issueNumber})`,
            branchName,
            current.sha
          );
          return;
        }

        if (entry.action === "create") {
          const generated = await generateIssueFileContent({
            path: entry.path,
            currentContent: null,
            action: "create",
            changeDescription: entry.changeDescription,
            issueTitle: issue.title,
            issueBody: issue.body,
          });
          if (generated.length > MAX_AUTO_PR_FILE_CHARS) {
            throw new Error(`File too large: ${entry.path}`);
          }
          await createOrUpdateRepoFile(
            token,
            owner,
            repo,
            entry.path,
            generated,
            `feat: add ${entry.path} (stitch/issue-${issueNumber})`,
            branchName
          );
          return;
        }

        const onBranch = await getRepoFileContentWithSha(
          token,
          owner,
          repo,
          entry.path,
          branchName
        );
        const onDefault = await getRepoFileContentWithSha(
          token,
          owner,
          repo,
          entry.path
        );
        const currentContent = onBranch?.content ?? onDefault?.content ?? null;
        const shaForUpdate = onBranch?.sha ?? onDefault?.sha ?? null;

        if (currentContent == null && entry.action === "modify") {
          throw new Error(`Cannot modify missing file: ${entry.path}`);
        }

        const generated = await generateIssueFileContent({
          path: entry.path,
          currentContent,
          action: "modify",
          changeDescription: entry.changeDescription,
          issueTitle: issue.title,
          issueBody: issue.body,
        });
        if (generated.length > MAX_AUTO_PR_FILE_CHARS) {
          throw new Error(`File too large: ${entry.path}`);
        }
        await createOrUpdateRepoFile(
          token,
          owner,
          repo,
          entry.path,
          generated,
          `fix: update ${entry.path} (stitch/issue-${issueNumber})`,
          branchName,
          shaForUpdate
        );
      });
    }

    await step.run("mark-files-written", async () => {
      await prisma.autoPullRequest.updateMany({
        where: { commandCommentId },
        data: { status: "files_written" },
      });
    });

    const prResult = await step.run("open-pull-request", async () => {
      try {
        const p = await createPullRequest(
          token,
          owner,
          repo,
          `[stitch] ${issue.title.slice(0, 120)}`,
          `Automated fix for #${issueNumber}.\n\nCloses #${issueNumber}\n\n---\n*Opened by **Stitch AI** via \`/stitch fix\`.*`,
          branchName,
          baseBranch
        );
        return { ok: true as const, pr: p };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });

    if (!prResult.ok) {
      await markFailed(
        "pr_open_failed",
        `**Stitch AI** wrote branch \`${branchName}\` but could not open a PR: ${prResult.error}`,
      );
      return { skipped: "pr_open_failed" as const };
    }

    const pr = prResult.pr;

    await step.run("finalize-db-and-comment", async () => {
      await prisma.autoPullRequest.updateMany({
        where: { commandCommentId },
        data: {
          status: "pr_opened",
          prNumber: pr.number,
          prUrl: pr.htmlUrl,
          branchName,
        },
      });
      await postIssueComment(
        token,
        owner,
        repo,
        issueNumber,
        `**Stitch AI** opened pull request ${pr.htmlUrl} from branch \`${branchName}\`.`,
      );
    });

    return { success: true, prUrl: pr.htmlUrl };
  }
);

import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db";
import { verifyGitHubWebhookSignature256 } from "@/lib/github-webhook-verify";
import { hasStitchFixCommand } from "@/lib/stitch-github-commands";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!secret) {
      console.error("GITHUB_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Webhook misconfigured: missing GITHUB_WEBHOOK_SECRET" },
        { status: 503 }
      );
    }

    if (!verifyGitHubWebhookSignature256(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const event = req.headers.get("x-github-event");
    console.log(`Received github event: ${event}`);

    if (event === "ping") {
      return NextResponse.json({ message: "Pong" }, { status: 200 });
    }

    const repositoryPayload = body.repository as { full_name?: string } | undefined;
    const fullName = repositoryPayload?.full_name;
    if (!fullName || typeof fullName !== "string") {
      return NextResponse.json({ message: "No repository" }, { status: 200 });
    }

    const [owner, repoName] = fullName.split("/");
    if (!owner || !repoName) {
      return NextResponse.json({ message: "Bad repository name" }, { status: 200 });
    }

    const repository = await prisma.repository.findFirst({
      where: { owner, name: repoName },
    });

    if (!repository) {
      return NextResponse.json({ message: "Repository not connected" }, { status: 200 });
    }

    const userId = repository.userId;

    if (event === "pull_request") {
      const action = body.action as string | undefined;
      const pr = body.pull_request as { number?: number } | undefined;
      const prNumber = pr?.number;
      if (
        (action === "opened" || action === "synchronize") &&
        typeof prNumber === "number"
      ) {
        await inngest.send({
          name: "pr.review.requested",
          data: {
            owner,
            repo: repoName,
            prNumber,
            userId,
          },
        });
      }
    }

    if (event === "issues") {
      const action = body.action as string | undefined;
      const issue = body.issue as
        | { number?: number; title?: string; html_url?: string; body?: string | null }
        | undefined;
      const issueNumber = issue?.number;
      if (
        (action === "opened" ||
          action === "reopened" ||
          action === "edited") &&
        typeof issueNumber === "number"
      ) {
        await inngest.send({
          name: "issue.analysis.requested",
          data: {
            owner,
            repo: repoName,
            issueNumber,
            userId,
            issueTitle: issue?.title ?? "",
            issueUrl: issue?.html_url ?? "",
            issueBody: issue?.body ?? "",
          },
        });
      }
    }

    if (event === "issue_comment") {
      const action = body.action as string | undefined;
      if (action === "created") {
        const issue = body.issue as
          | { number?: number; pull_request?: unknown }
          | undefined;
        if (issue?.pull_request) {
          return NextResponse.json({ message: "Skipped PR thread" }, { status: 200 });
        }

        const comment = body.comment as
          | {
              id?: number;
              body?: string | null;
              user?: { login?: string; type?: string };
            }
          | undefined;

        if (comment?.user?.type === "Bot") {
          return NextResponse.json({ message: "Skipped bot" }, { status: 200 });
        }

        const commentBody = comment?.body ?? "";
        if (!hasStitchFixCommand(commentBody)) {
          return NextResponse.json({ message: "Event Processed" }, { status: 200 });
        }

        const issueNumber = issue?.number;
        const commentId = comment?.id;
        const author = comment?.user?.login;
        if (
          typeof issueNumber !== "number" ||
          typeof commentId !== "number" ||
          typeof author !== "string"
        ) {
          return NextResponse.json({ message: "Bad payload" }, { status: 200 });
        }

        await inngest.send({
          name: "issue.auto_pr.requested",
          data: {
            owner,
            repo: repoName,
            issueNumber,
            userId,
            commandCommentId: String(commentId),
            commandCommentAuthor: author,
            commandCommentBody: commentBody,
          },
        });
      }
    }

    return NextResponse.json({ message: "Event Processed" }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

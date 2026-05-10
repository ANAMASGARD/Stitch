"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getIssueAutomationHistory() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const issueAnalysis = (
    prisma as unknown as {
      issueAnalysis?: { findMany: typeof prisma.issueAnalysis.findMany };
    }
  ).issueAnalysis;
  const autoPullRequest = (
    prisma as unknown as {
      autoPullRequest?: { findMany: typeof prisma.autoPullRequest.findMany };
    }
  ).autoPullRequest;

  if (
    typeof issueAnalysis?.findMany !== "function" ||
    typeof autoPullRequest?.findMany !== "function"
  ) {
    console.warn(
      "[Stitch] Prisma client is missing IssueAnalysis / AutoPullRequest models — run `npx prisma generate` and restart the dev server."
    );
    return { analyses: [], autoPullRequests: [] };
  }

  try {
    const [analyses, autoPullRequests] = await Promise.all([
      issueAnalysis.findMany({
        where: {
          repository: { userId: session.user.id },
        },
        include: { repository: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      autoPullRequest.findMany({
        where: {
          repository: { userId: session.user.id },
        },
        include: { repository: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
    ]);

    return { analyses, autoPullRequests };
  } catch (e) {
    console.error("[getIssueAutomationHistory]", e);
    return { analyses: [], autoPullRequests: [] };
  }
}

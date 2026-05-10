"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getStitchPullRequests() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const autoPullRequest = (
    prisma as unknown as {
      autoPullRequest?: { findMany: typeof prisma.autoPullRequest.findMany };
    }
  ).autoPullRequest;

  if (typeof autoPullRequest?.findMany !== "function") {
    console.warn(
      "[Stitch] Prisma client is missing AutoPullRequest — run `npx prisma generate` and restart the dev server."
    );
    return [];
  }

  try {
    return await autoPullRequest.findMany({
      where: {
        repository: { userId: session.user.id },
      },
      include: { repository: true },
      orderBy: { updatedAt: "desc" },
      take: 60,
    });
  } catch (e) {
    console.error("[getStitchPullRequests]", e);
    return [];
  }
}

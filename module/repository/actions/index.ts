"use server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import { getRepositories, createWebhook } from "@/module/github/lib/github";
import { headers } from "next/headers";

export const fetchRepositories = async (page: number = 1, pageNumber: number = 10) => {
        const session = await auth.api.getSession({
                headers: await headers()
        });
        if (!session) {
                throw new Error("Not authenticated");
        }
        const githubRepos = await getRepositories(page, pageNumber);

        const dbRepos = await prisma.repository.findMany({
                where: {
                        userId: session.user.id
                }
        });

        const connectedRepoIds = new Set(dbRepos.map(repo => repo.githubId));

        return githubRepos.map((repo) => ({
            ...repo,
            topics: repo.topics ?? [],
            isConnected: connectedRepoIds.has(BigInt(repo.id))
        }));
}

export const connectRepository = async (owner: string, repo: string, githubId: number) => {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const normalizedOwner = owner?.trim();
    const normalizedRepo = repo?.trim();

    if (!normalizedOwner || !normalizedRepo) {
        throw new Error(`Invalid repository: owner="${owner ?? ""}", repo="${repo ?? ""}"`);
    }

    // TODO: CHECK IF USER CAN CONNECT MORE REPO

    const existingRepository = await prisma.repository.findFirst({
        where: {
            githubId: BigInt(githubId),
            userId: session.user.id
        }
    });

    if (!existingRepository) {
        try {
            await prisma.repository.create({
                data: {
                    githubId: BigInt(githubId),
                    name: normalizedRepo,
                    owner: normalizedOwner,
                    fullName: `${normalizedOwner}/${normalizedRepo}`,
                    url: `https://github.com/${normalizedOwner}/${normalizedRepo}`,
                    userId: session.user.id,
                },
            });
        } catch (e: unknown) {
            const code =
                e &&
                typeof e === "object" &&
                "code" in e &&
                typeof (e as { code: unknown }).code === "string"
                    ? (e as { code: string }).code
                    : undefined;
            if (code === "P2002") {
                throw new Error(
                    "This repository is already connected for your account, or another row conflicts. Refresh the page.",
                );
            }
            throw e;
        }
    }

    let webhookConfigured = false;
    try {
        const webhook = await createWebhook(normalizedOwner, normalizedRepo);
        webhookConfigured = Boolean(webhook);
    } catch (error) {
        console.error("Failed to create or update GitHub webhook:", error);
    }

    // TODO: INCREMENT REPOSITORY COUNT FOR USAGE TRACKING

    // TODO: TRIGGER REPOSITORY INDEXING FOR THE RAG (FIRE AND FORGET)
    try {
        await inngest.send({
            id: `repository.connected:${session.user.id}:${normalizedOwner}/${normalizedRepo}`,
            name: "repository.connected",
            data: {
                owner: normalizedOwner,
                repo: normalizedRepo,
                userId: session.user.id
            }
        })
    } catch (error) {
        console.error("Failed to trigger repository indexing:", error);
    }

    return { success: true, webhookConfigured };
};

export const disconnectRepository = async (githubId: number) => {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    await prisma.repository.deleteMany({
        where: {
            githubId: BigInt(githubId),
            userId: session.user.id
        }
    });

    return { success: true };
};
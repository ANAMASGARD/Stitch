"use server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
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

    // TODO: CHECK IF USER CAN CONNECT MORE REPO

    const webhook = await createWebhook(owner, repo);

    if (webhook) {
        await prisma.repository.create({
            data: {
                githubId: BigInt(githubId),
                name: repo,
                owner,
                fullName: `${owner}/${repo}`,
                url: `https://github.com/${owner}/${repo}`,
                userId: session.user.id
            }
        });
    }

    // TODO: INCREMENT REPOSITORY COUNT FOR USAGE TRACKING

    // TODO: TRIGGER REPOSITORY INDEXING FOR THE RAG (FIRE AND FORGET)

    return webhook;
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
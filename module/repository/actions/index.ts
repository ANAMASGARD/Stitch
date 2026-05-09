"use server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { getRepositories } from "@/module/github/lib/github";
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

        return githubRepos.map((repo: any) => ({
            ...repo,
            isConnected: connectedRepoIds.has(BigInt(repo.id))
        }));
        
}
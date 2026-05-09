 "use server";

import prisma from "@/lib/db";
import { getPullRequestDiff } from "@/module/github/lib/github";
import { inngest } from "@/inngest/client";



export async function reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
) {
    try { 
    const repository = await prisma.repository.findFirst({
        where: {
            owner,
            name: repo
        },
        include: {
            user: {
                include: {
                    accounts: {
                        where: {
                            providerId: "github"
                        }
                    }
                }
            }
        }
    });

    if (!repository) {
        throw new Error(`Repository ${owner}/${repo} not found`);
    }

    const githubAccount = repository.user.accounts[0];

    if (!githubAccount?.accessToken) {
        throw new Error("No GitHub access token found for repository owner")
    }

    const token = githubAccount.accessToken

    await getPullRequestDiff(token , owner , repo , prNumber)

    await inngest.send({
        name: "pr.review.requested",
        data: {
            owner,
            repo,
            prNumber,
            userId: repository.user.id
        }
    })

    return {success:true, message:"Review Queued"}
} catch (error) {
    try {
        const repository = await prisma.repository.findFirst({
            where: { owner, name: repo }
        })

        if (repository) {
            await prisma.review.create({
                data: {
                    repositoryId: repository.id,
                    prNumber,
                    prTitle: "Failed to fetch PR",
                    prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                    review: `Error: ${error instanceof Error ? error.message : "Unknown Error"}`,
                    status: "failed"
                }
            })
        }
    } catch (dbError) {
        console.error("Failed to create review:", dbError);
        return {success:false, message:"Failed to create review"}
    }
}
}

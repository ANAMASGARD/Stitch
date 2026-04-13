import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";

export type ContributionDay = {
    date: string;
    contributionCount: number;
    color: string;
};

export type ContributionCalendar = {
    totalContributions: number;
    weeks: {
        contributionDays: ContributionDay[];
    }[];
};

type ContributionResponse = {
    user: {
        contributionsCollection: {
            contributionCalendar: ContributionCalendar;
        };
    };
};

/**
 * Getting the GitHub access token for the user and creating an Octokit instance to interact with the GitHub API.
 *
 */
export const getGithubToken = async() => {
    const session = await auth.api.getSession({
        headers:await headers(),
    });
    if (!session) {
        throw new Error("User is not authenticated");
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github",
        },
    });

    if (!account) {
        throw new Error("GitHub account not found for the user");
    }

    return account.accessToken;
}

export async function fetchUserContribution(token: string , username: string) {
    const octokit = new Octokit({
        auth: token,
    });

    const query = `
    query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    totalContributions
                    weeks {
                        contributionDays {
                            date
                            contributionCount
                            color
                        }
                    }
                }
            }
        }
    }
    `;
    try {
        const response = await octokit.graphql<ContributionResponse>(query, {
            username,
        });
        return response.user.contributionsCollection.contributionCalendar;
    } catch (error) {
        console.error("Error fetching user contributions:", error);
        throw error;
    }
}

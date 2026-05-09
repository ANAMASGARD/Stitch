import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";

export type GithubContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

export type GithubContributionDay = {
  date: string;
  contributionCount: number;
  contributionLevel: GithubContributionLevel;
};

export type GithubContributionSummary = {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  contributionCalendar: {
    totalContributions: number;
    weeks: Array<{
      contributionDays: GithubContributionDay[];
    }>;
  };
  commitContributionsByRepository: Array<{
    contributions: {
      nodes: Array<{
        occurredAt: string;
        commitCount: number;
      }>;
    };
  }>;
  pullRequestContributionsByRepository: Array<{
    contributions: {
      nodes: Array<{
        occurredAt: string;
      }>;
    };
  }>;
  pullRequestReviewContributionsByRepository: Array<{
    contributions: {
      nodes: Array<{
        occurredAt: string;
      }>;
    };
  }>;
};

export const getGithubToken = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
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

  if (!account.accessToken) {
    throw new Error("GitHub access token is missing for the user");
  }

  return account.accessToken;
};

export async function fetchGithubContributionSummary(
  token: string,
  username: string,
  from: string,
  to: string,
): Promise<GithubContributionSummary> {
  const octokit = new Octokit({ auth: token });

  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
          commitContributionsByRepository(maxRepositories: 100) {
            contributions(first: 100) {
              nodes {
                occurredAt
                commitCount
              }
            }
          }
          pullRequestContributionsByRepository(maxRepositories: 100) {
            contributions(first: 100) {
              nodes {
                occurredAt
              }
            }
          }
          pullRequestReviewContributionsByRepository(maxRepositories: 100) {
            contributions(first: 100) {
              nodes {
                occurredAt
              }
            }
          }
        }
      }
    }
  `;

  const response = await octokit.graphql<{
    user: {
      contributionsCollection: GithubContributionSummary;
    };
  }>(query, {
    username,
    from,
    to,
  });

  return response.user.contributionsCollection;
}

/** Legacy calendar shape (simple contribution grid) — kept for callers that still use it. */
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

type LegacyContributionResponse = {
  user: {
    contributionsCollection: {
      contributionCalendar: ContributionCalendar;
    };
  };
};

export async function fetchUserContribution(token: string, username: string) {
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
    const response = await octokit.graphql<LegacyContributionResponse>(query, {
      username,
    });
    return response.user.contributionsCollection.contributionCalendar;
  } catch (error) {
    console.error("Error fetching user contributions:", error);
    throw error;
  }
}

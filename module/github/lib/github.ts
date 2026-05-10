import { Octokit } from "@/module/github/lib/octokit";
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

export async function getRepositories(page: number = 1, perPage: number = 10) {
  const token = await getGithubToken();
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    direction: "desc",
    visibility: "all",
    page,
    per_page: perPage,
  });
  return data;
}

function assertRepositoryCoordinates(owner: string, repo: string) {
    const normalizedOwner = owner?.trim();
    const normalizedRepo = repo?.trim();

    if (!normalizedOwner || !normalizedRepo) {
        throw new Error(
            `Invalid repository coordinates: owner="${owner ?? ""}", repo="${repo ?? ""}"`
        );
    }

    return {
        owner: normalizedOwner,
        repo: normalizedRepo,
    };
}

const STITCH_WEBHOOK_EVENTS = ["pull_request", "issues", "issue_comment"] as const;

export const createWebhook = async (owner: string, repo: string) => {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const token = await getGithubToken();

    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (!secret) {
        throw new Error(
            "GITHUB_WEBHOOK_SECRET is required to create or update the GitHub webhook (signature verification)."
        );
    }

    const octokit = new Octokit({ auth: token });
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;

    const { data: hooks } = await octokit.rest.repos.listWebhooks({
        owner: coordinates.owner,
        repo: coordinates.repo,
    });

    const existingHook = hooks.find((hook) => hook.config.url === webhookUrl);

    const config = {
        url: webhookUrl,
        content_type: "json" as const,
        secret,
    };

    if (existingHook) {
        const { data } = await octokit.rest.repos.updateWebhook({
            owner: coordinates.owner,
            repo: coordinates.repo,
            hook_id: existingHook.id,
            config,
            events: [...STITCH_WEBHOOK_EVENTS],
            active: true,
        });
        return data;
    }

    const { data } = await octokit.rest.repos.createWebhook({
        owner: coordinates.owner,
        repo: coordinates.repo,
        config,
        events: [...STITCH_WEBHOOK_EVENTS],
    });

    return data;
};

export const deleteWebhook = async (owner: string, repo: string) => {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const token = await getGithubToken();
    const octokit = new Octokit({ auth: token });
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;
  
    try {
      const { data: hooks } = await octokit.rest.repos.listWebhooks({
        owner: coordinates.owner,
        repo: coordinates.repo,
      });
  
      const hookToDelete = hooks.find((hook) => hook.config.url === webhookUrl);
  
      if (hookToDelete) {
        await octokit.rest.repos.deleteWebhook({
          owner: coordinates.owner,
          repo: coordinates.repo,
          hook_id: hookToDelete.id,
        });
      }
  
      return { success: true, message: "Webhook deleted successfully" };
    } catch (error) {
      console.error("Error deleting webhook:", error);
      return { success: false, message: "Failed to delete webhook" };
    }
  };
export async function getRepoFileContent(
    token: string,
    owner: string,
    repo: string,
    path: string = ""
) : Promise<{ path: string, content: string }[]> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.getContent({
        owner: coordinates.owner,
        repo: coordinates.repo,
        path,
    });
    if (!Array.isArray(data)) {
        if (data.type === "file" && data.content) {
            return[{
                path: data.path,
                content: Buffer.from(data.content, "base64").toString("utf-8"),
            }];
            
        }
        return [];
    }
    let files: { path: string, content: string }[] = [];
    for(const item of data){
        if(item.type === "file"){
            const {data:fileData} = await octokit.rest.repos.getContent({
                owner: coordinates.owner,
                repo: coordinates.repo,
                path:item.path
            })
            if (!Array.isArray(fileData) && fileData.type === "file" && fileData.content) {
                // Filter out non-code files if needed (images, etc.)
                // For now, let's include everything that looks like text
                if (!item.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)) {
                    files.push({
                        path: item.path,
                        content: Buffer.from(fileData.content, "base64").toString("utf-8"),
                    });
                }
            }
        } else if (item.type === "dir") {
            const subFiles = await getRepoFileContent(
                token,
                coordinates.owner,
                coordinates.repo,
                item.path
            )

            files = files.concat(subFiles)
        }
    }
    return files;
}

const PR_REVIEW_CONTEXT_MAX_CHARS = 28_000;

/**
 * Human-readable PR context beyond the raw patch: file list, submitted reviews,
 * inline review comments, and issue-thread comments (truncated). Mirrors what
 * agents often gather via GitHub MCP tools, for programmatic review prompts.
 */
async function buildGithubPrReviewContext(
    octokit: InstanceType<typeof Octokit>,
    owner: string,
    repo: string,
    prNumber: number,
): Promise<string> {
    const blocks: string[] = [];

    const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
    });
    const fileLines = files.slice(0, 80).map(
        (f) =>
            `- \`${f.filename}\` (${f.status}) +${f.additions}/-${f.deletions}`,
    );
    blocks.push(`## Changed files\n${fileLines.join("\n")}`);

    try {
        const { data: reviews } = await octokit.rest.pulls.listReviews({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 40,
        });
        if (reviews.length) {
            const lines = reviews.map((r) => {
                const who = r.user?.login ?? "?";
                const state = r.state ?? "?";
                const body = (r.body ?? "").trim().slice(0, 900);
                return `- **${who}** [${state}]: ${body || "(no body)"}`;
            });
            blocks.push(`## Submitted PR reviews\n${lines.join("\n")}`);
        }
    } catch {
        /* optional */
    }

    try {
        const { data: inline } = await octokit.rest.pulls.listReviewComments({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 60,
        });
        if (inline.length) {
            const lines = inline.map((c) => {
                const path = c.path ?? "?";
                const body = (c.body ?? "").trim().slice(0, 550);
                return `- \`${path}\` (@${c.user?.login ?? "?"}): ${body}`;
            });
            blocks.push(`## Inline review comments\n${lines.join("\n")}`);
        }
    } catch {
        /* optional */
    }

    try {
        const { data: issueComments } = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
            per_page: 35,
        });
        if (issueComments.length) {
            const lines = issueComments.map((c) => {
                const who = c.user?.login ?? "?";
                const body = (c.body ?? "").trim().slice(0, 700);
                return `- **${who}**: ${body}`;
            });
            blocks.push(`## Issue / PR conversation\n${lines.join("\n")}`);
        }
    } catch {
        /* optional */
    }

    let text = blocks.join("\n\n");
    if (text.length > PR_REVIEW_CONTEXT_MAX_CHARS) {
        text =
            text.slice(0, PR_REVIEW_CONTEXT_MAX_CHARS) +
            "\n\n… (GitHub context truncated for size)";
    }
    return text;
}

export async function getPullRequestDiff(
    token: string,
    owner: string,
    repo: string,
    prNumber: number
) {
    const octokit = new Octokit({ auth: token });

    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    const { data: diff } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
            format: "diff",
        },
    });

    let githubThreadContext = "";
    try {
        githubThreadContext = await buildGithubPrReviewContext(
            octokit,
            owner,
            repo,
            prNumber,
        );
    } catch {
        githubThreadContext = "";
    }

    return {
        title: pr.title,
        diff: diff as unknown as string,
        description: pr.body || "",
        githubThreadContext,
    };
}

export async function postReviewComment(
    token: string,
    owner: string,
    repo: string,
    prNumber: number,
    review: string
) {
    const octokit = new Octokit({ auth: token });

    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `## AI Code Review\n\n${review}\n\n--\n*Powered by Stitch*`,
    });
}

export async function postIssueComment(
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
) {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    await octokit.rest.issues.createComment({
        owner: coordinates.owner,
        repo: coordinates.repo,
        issue_number: issueNumber,
        body,
    });
}

export async function getIssue(
    token: string,
    owner: string,
    repo: string,
    issueNumber: number
): Promise<{ title: string; body: string; htmlUrl: string }> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.get({
        owner: coordinates.owner,
        repo: coordinates.repo,
        issue_number: issueNumber,
    });
    return {
        title: data.title ?? "",
        body: data.body ?? "",
        htmlUrl: data.html_url ?? "",
    };
}

export async function getDefaultBranch(
    token: string,
    owner: string,
    repo: string
): Promise<string> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.get({
        owner: coordinates.owner,
        repo: coordinates.repo,
    });
    return data.default_branch;
}

/**
 * Create a new branch at the same commit as the repo default branch.
 * If the ref already exists (422), treat as success for idempotent retries.
 */
export async function createBranchFromDefault(
    token: string,
    owner: string,
    repo: string,
    branchName: string
): Promise<void> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });

    const { data: repoData } = await octokit.rest.repos.get({
        owner: coordinates.owner,
        repo: coordinates.repo,
    });
    const base = repoData.default_branch;

    const { data: refData } = await octokit.rest.git.getRef({
        owner: coordinates.owner,
        repo: coordinates.repo,
        ref: `heads/${base}`,
    });
    const sha = refData.object.sha;

    try {
        await octokit.rest.git.createRef({
            owner: coordinates.owner,
            repo: coordinates.repo,
            ref: `refs/heads/${branchName}`,
            sha,
        });
    } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status === 422) {
            return;
        }
        throw err;
    }
}

export async function getRepoFileContentWithSha(
    token: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string
): Promise<{ content: string; sha: string } | null> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: coordinates.owner,
            repo: coordinates.repo,
            path,
            ...(ref ? { ref } : {}),
        });
        if (Array.isArray(data) || data.type !== "file" || !data.content || !data.sha) {
            return null;
        }
        return {
            content: Buffer.from(data.content, "base64").toString("utf-8"),
            sha: data.sha,
        };
    } catch {
        return null;
    }
}

export async function createOrUpdateRepoFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string | null
): Promise<void> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    const contentB64 = Buffer.from(content, "utf-8").toString("base64");
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: coordinates.owner,
        repo: coordinates.repo,
        path,
        message,
        content: contentB64,
        branch,
        ...(sha ? { sha } : {}),
    });
}

export async function deleteRepoFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    message: string,
    branch: string,
    sha: string
): Promise<void> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    await octokit.rest.repos.deleteFile({
        owner: coordinates.owner,
        repo: coordinates.repo,
        path,
        message,
        branch,
        sha,
    });
}

export async function createPullRequest(
    token: string,
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
): Promise<{ number: number; htmlUrl: string }> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.pulls.create({
        owner: coordinates.owner,
        repo: coordinates.repo,
        title,
        body,
        head,
        base,
    });
    return {
        number: data.number,
        htmlUrl: data.html_url ?? "",
    };
}

/** GitHub permission string: admin | maintain | write | triage | read | none */
export async function getCollaboratorPermissionLevel(
    token: string,
    owner: string,
    repo: string,
    username: string
): Promise<string | null> {
    const coordinates = assertRepositoryCoordinates(owner, repo);
    const octokit = new Octokit({ auth: token });
    try {
        const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
            owner: coordinates.owner,
            repo: coordinates.repo,
            username,
        });
        return data.permission;
    } catch {
        return null;
    }
}

"use server";

import {
  fetchGithubContributionSummary,
  getGithubToken,
  type GithubContributionLevel,
} from "@/module/github/lib/github";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Octokit } from "octokit";

type ContributionCalendarDay = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const getThisYearRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString();
  const to = now.toISOString();
  return { from, to };
};

const getCalendarYearRange = (year: number) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const from = new Date(year, 0, 1).toISOString();
  const to =
    year === currentYear
      ? now.toISOString()
      : new Date(year, 11, 31, 23, 59, 59, 999).toISOString();
  return { from, to };
};

const mapContributionLevelToNumber = (
  level: GithubContributionLevel,
): 0 | 1 | 2 | 3 | 4 => {
  switch (level) {
    case "NONE":
      return 0;
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
  }
};

const getGithubContext = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("User is not authenticated");
  }

  const token = await getGithubToken();
  const octokit = new Octokit({ auth: token });
  const { data: user } = await octokit.rest.users.getAuthenticated();

  return { token, octokit, username: user.login };
};

export async function getContributionData(year?: number) {
  try {
    const { token, username } = await getGithubContext();
    const selectedYear = year ?? new Date().getFullYear();
    const { from, to } = getCalendarYearRange(selectedYear);
    const summary = await fetchGithubContributionSummary(
      token,
      username,
      from,
      to,
    );

    const contributions: ContributionCalendarDay[] =
      summary.contributionCalendar.weeks.flatMap((week) =>
        week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
          level: mapContributionLevelToNumber(day.contributionLevel),
        })),
      );
    return contributions;
  } catch (error) {
    console.error("Error fetching contribution data:", error);
    return [];
  }
}

export async function getDashboardStats() {
  try {
    const { token, octokit, username } = await getGithubContext();
    const { from, to } = getThisYearRange();
    const summary = await fetchGithubContributionSummary(
      token,
      username,
      from,
      to,
    );

    const repos = await octokit.paginate(
      octokit.rest.repos.listForAuthenticatedUser,
      {
        visibility: "all",
        affiliation: "owner",
        per_page: 100,
      },
    );

    const totalRepos = repos.length;
    const totalCommits = summary.totalCommitContributions;
    const totalPRs = summary.totalPullRequestContributions;
    const totalAIReviews = 0;

    return {
      totalCommits,
      totalPRs,
      totalRepos,
      totalAIReviews,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalCommits: 0,
      totalPRs: 0,
      totalRepos: 0,
      totalAIReviews: 0,
    };
  }
}

export async function getMonthlyActivity(year?: number) {
  try {
    const { token, username } = await getGithubContext();
    const currentYear = new Date().getFullYear();
    const selectedYear = year ?? currentYear;
    const { from, to } = getCalendarYearRange(selectedYear);
    const summary = await fetchGithubContributionSummary(
      token,
      username,
      from,
      to,
    );

    const monthlyData: Record<
      string,
      { commits: number; pullRequests: number; aiReviews: number }
    > = {};

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let month = 0; month < 12; month++) {
      const monthKey = `${monthNames[month]} ${selectedYear}`;
      monthlyData[monthKey] = { commits: 0, pullRequests: 0, aiReviews: 0 };
    }

    summary.commitContributionsByRepository.forEach((repo) => {
      repo.contributions.nodes.forEach((contribution) => {
        const date = new Date(contribution.occurredAt);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].commits += contribution.commitCount;
        }
      });
    });

    summary.pullRequestContributionsByRepository.forEach((repo) => {
      repo.contributions.nodes.forEach((contribution) => {
        const date = new Date(contribution.occurredAt);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].pullRequests += 1;
        }
      });
    });

    summary.pullRequestReviewContributionsByRepository.forEach((repo) => {
      repo.contributions.nodes.forEach((contribution) => {
        const date = new Date(contribution.occurredAt);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].aiReviews += 1;
        }
      });
    });

    return Object.keys(monthlyData).map((name) => ({
      name,
      ...monthlyData[name],
    }));
  } catch (error) {
    console.error("Error fetching monthly activity:", error);
    return [];
  }
}

"use server";
import {
    fetchUserContribution,
    getGithubToken ,
    type ContributionDay,
} from "@/module/github/lib/github";
import {auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Octokit } from "octokit";

type MonthlyActivity = {
    commits: number;
    prs: number;
    reviews: number;
};

type PullRequestSearchItem = {
    created_at?: string | null;
};

export async function getDashboardStats(){
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session) {
            throw new Error("User is not authenticated");
        }

        const token = await getGithubToken();

        // Add a check to ensure token is a valid string before proceeding
        if (!token) {
            throw new Error("GitHub token not found");
        }

        const octokit = new Octokit({
            auth: token,
        });
        const { data:user } = await octokit.rest.users.getAuthenticated();

        //TODO : FETCH TOTAL CONNECTED REPO FROM DB ;
        const totalRepos = 30;

        // Since we checked if (!token) above, TypeScript now knows token is a string here
        const calendar = await fetchUserContribution(token , user.login);
        const totalCommits = calendar?.totalContributions || 0;

        // Corrected spelling from 'issusesAndPullRequests' to 'issuesAndPullRequests'
        const { data:prs } = await octokit.rest.search.issuesAndPullRequests({
            q: `author:${user.login} type:pr`,
            per_page: 1,
        });
        const totalPRs = prs.total_count;

        //TODO: COUNT AI REVIEWS FROM DB
        const totalAIReviews = 44;

        return {
            totalCommits,
            totalPRs,
            totalRepos,
            totalAIReviews,
        }

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

export async function getMonthlyActivity(){
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session) {
            throw new Error("User is not authenticated");
        }

        const token = await getGithubToken();

          // Add a check to ensure token is a valid string before proceeding
        if (!token) {
            throw new Error("GitHub token not found");
        }

        const octokit = new Octokit({
            auth: token,
        });
        const { data:user } = await octokit.rest.users.getAuthenticated();

        const calendar = await fetchUserContribution(token , user.login);

        if (!calendar) {
            return [];
        }
        const monthlyData: Record<string, MonthlyActivity> = {};

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

        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            monthlyData[monthKey] = { commits: 0, prs: 0, reviews: 0 };
        }

        const toMonthKey = (date: Date) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

        calendar.weeks.forEach((week) => {
            week.contributionDays.forEach((day: ContributionDay) => {
                const date = new Date(day.date);
                const monthKey = toMonthKey(date);
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].commits += day.contributionCount;
                }
            });
        });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        //TODO: REVIEWS'S REAL DATA
        const generateSampleReviews = () => {
            const sampleReviews = [];
            const now = new Date();
            // Generate random reviews over the past 6 months
            for (let i = 0; i < 45; i++) {
                const randomDaysAgo = Math.floor(Math.random() * 180); // Random day in last 6 months
                const reviewDate = new Date(now);
                reviewDate.setDate(reviewDate.getDate() - randomDaysAgo);

                sampleReviews.push({
                    createdAt: reviewDate,
                });
            }
            return sampleReviews;
        };

        const reviews = generateSampleReviews();

        reviews.forEach((review) => {
            const monthKey = toMonthKey(review.createdAt);
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].reviews += 1;
            }
        });

        const prs = await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
            q: `author:${user.login} type:pr created:>${
            sixMonthsAgo.toISOString().split("T")[0]
            }`,
            per_page: 100,
        });

        prs.forEach((pr: PullRequestSearchItem) => {
            if (!pr.created_at) return;
            const date = new Date(pr.created_at);
            const monthKey = toMonthKey(date);
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].prs += 1;
            }
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

"use client";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/retroui/Card";
import {
  GitCommit,
  GitPullRequest,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { getDashboardStats } from "@/module/dashboard/actions";
import ContributionGraph from "@/module/dashboard/components/contribution-graph";
import ActivityOverview from "@/module/dashboard/components/activity-overview";

const MainPage = () => {
  const { data: session } = useSession();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => await getDashboardStats(),
    refetchOnWindowFocus: false,
  });

return (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Welcome back, {session?.user?.name}</h1>
      <p className="text-muted-foreground ">
        Overview of your coding activity and AI reviews .
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Card className="w-full rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalRepos || 0}</div>
          <p className="text-xs text-muted-foreground">Connected repositories</p>
        </CardContent>
      </Card>

      <Card className="w-full rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Commits</CardTitle>
          <GitCommit className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalCommits || 0}</div>
          <p className="text-xs text-muted-foreground">This year</p>
        </CardContent>
      </Card>

      <Card className="w-full rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pull Requests</CardTitle>
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalPRs || 0}</div>
          <p className="text-xs text-muted-foreground">This year</p>
        </CardContent>
      </Card>

      <Card className="w-full rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Reviews</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalAIReviews || 0}</div>
          <p className="text-xs text-muted-foreground">Generated reviews</p>
        </CardContent>
      </Card>
    </div>
    <Card className="block w-full rounded-xl">
    <CardHeader className="pb-2">

<CardTitle>Contribution Activity</CardTitle>
<CardDescription>Visualizing your coding frequency over the last year</CardDescription>
</CardHeader>
<CardContent className="pt-0">
<ContributionGraph />
</CardContent>
    </Card>
    <ActivityOverview />
  </div>
)
};
export default MainPage;
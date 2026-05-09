"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/retroui/Card";
import { getMonthlyActivity } from "@/module/dashboard/actions";
import { Clock3 } from "lucide-react";

type MonthlyActivityPoint = {
  name: string;
  commits: number;
  pullRequests: number;
  aiReviews: number;
};

const ActivityTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const values = Object.fromEntries(payload.map((entry) => [entry.name, entry.value]));

  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm shadow-sm">
      <p className="font-semibold">{label}</p>
      <p>Commits: {values.commits ?? 0}</p>
      <p>Pull Requests: {values.pullRequests ?? 0}</p>
      <p>AI Reviews: {values.aiReviews ?? 0}</p>
    </div>
  );
};

const ActivityOverview = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<number>(currentYear);

  React.useEffect(() => {
    const savedYear = window.localStorage.getItem("dashboard-activity-overview-year");
    if (!savedYear) return;
    const parsed = Number(savedYear);
    if (Number.isInteger(parsed)) {
      queueMicrotask(() => {
        setSelectedYear(parsed);
      });
    }
  }, []);

  const { data, isLoading } = useQuery<MonthlyActivityPoint[]>({
    queryKey: ["monthly-activity", selectedYear],
    queryFn: async () => await getMonthlyActivity(selectedYear),
    staleTime: 1000 * 60 * 5,
  });

  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = Number(event.target.value);
    setSelectedYear(year);
    window.localStorage.setItem("dashboard-activity-overview-year", String(year));
  };

  return (
    <Card className="block w-full rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>Monthly breakdown of commits, pull requests, and AI reviews</CardDescription>
          </div>
          <select
            aria-label="Select activity overview year"
            value={selectedYear}
            onChange={handleYearChange}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 animate-spin" />
              <span>Loading activity overview...</span>
            </div>
          </div>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<ActivityTooltip />} />
                <Legend />
                <Bar dataKey="commits" fill="#3b82f6" name="commits" />
                <Bar dataKey="pullRequests" fill="#8b5cf6" name="pullRequests" />
                <Bar dataKey="aiReviews" fill="#22c55e" name="aiReviews" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityOverview;

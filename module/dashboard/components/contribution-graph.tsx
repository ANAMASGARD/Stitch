"use client";
import React from "react";
import { ActivityCalendar } from "react-activity-calendar";
import { getContributionData } from "../actions";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";

type ContributionDay = {
  date: string;
  count: number;
  level: number;
};

const githubTheme = {
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
};

const ContributionGraph = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<number>(currentYear);

  React.useEffect(() => {
    const savedYear = window.localStorage.getItem("dashboard-contribution-year");
    if (!savedYear) return;
    const parsed = Number(savedYear);
    if (Number.isInteger(parsed)) {
      queueMicrotask(() => {
        setSelectedYear(parsed);
      });
    }
  }, []);

  const { data, isLoading } = useQuery<ContributionDay[]>({
    queryKey: ["contribution-graph", selectedYear],
    queryFn: async () => await getContributionData(selectedYear),
    staleTime: 1000 * 60 * 5,
  });

  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = Number(event.target.value);
    setSelectedYear(year);
    window.localStorage.setItem("dashboard-contribution-year", String(year));
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock3 className="h-4 w-4 animate-spin" />
          <span>Loading contribution data...</span>
        </div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8">
        <div className="text-muted-foreground">No contribution data found</div>
      </div>
    );
  }

  const totalContributions = data.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="w-full flex flex-col items-center gap-1 p-1">
      <div className="w-full flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground"> {totalContributions} </span>
          {` contributions in ${selectedYear}`}
        </div>
        <select
          aria-label="Select contribution year"
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

      <div className="w-full overflow-x-auto">
        <div className="flex justify-center min-w-max px-4">
          <ActivityCalendar
            data={data}
            colorScheme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
            theme={githubTheme}
            blockSize={11}
            blockMargin={4}
            fontSize={14}
          />
        </div>
      </div>
    </div>
  );
};

export default ContributionGraph;
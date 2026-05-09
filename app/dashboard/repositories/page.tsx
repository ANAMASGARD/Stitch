"use client";
import React, { useRef, useEffect } from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { Button } from "@/components/retroui/Button";
import { Command } from "@/components/retroui/Command";
import { ExternalLink, Star, Search } from "lucide-react";
import { useRepositories } from "@/module/repository/hooks/use-repositories";
import { RepositoryListSkeleton } from "@/module/repository/components/repository-skeleton";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  isConnected?: boolean;
}

const RepositoryPage = () => {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useRepositories();
  const [localConnectingId, setLocalConnectingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const observerTarget = useRef<HTMLDivElement>(null);

  const allRepositories = data?.pages.flatMap((page) => page) || [];

  const filteredRepositories = allRepositories.filter(
    (repo: Repository) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        threshold: 0.1
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleConnect = (repo: Repository) => {
    setLocalConnectingId(repo.id);
    // TODO: implement connect logic
    setTimeout(() => setLocalConnectingId(null), 1000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">Repositories</h1>
          <p className="text-muted-foreground">Manage and view all your GitHub repositories</p>
        </div>
        <RepositoryListSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error: {error?.message || "Failed to load repositories"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-head">Repositories</h1>
        <p className="text-muted-foreground">Manage and view all your GitHub repositories</p>
      </div>

      <Command className="border-2 shadow-md">
        <Command.Input
          placeholder="Search repositories..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        {searchQuery && (
          <Command.List>
            <Command.Empty>No repositories found.</Command.Empty>
            <Command.Group heading="Suggestions">
              {filteredRepositories.slice(0, 5).map((repo: Repository) => (
                <Command.Item
                  key={repo.id}
                  value={repo.full_name}
                  onSelect={() => setSearchQuery(repo.name)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  <span>{repo.full_name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        )}
      </Command>

      <div className="grid gap-4">
        {filteredRepositories.map((repo: Repository) => (
          <Card key={repo.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{repo.name}</CardTitle>
                    <Badge variant="outline">{repo.language || "Unknown"}</Badge>
                    {repo.isConnected && <Badge variant="solid">Connected</Badge>}
                  </div>
                  <CardDescription>{repo.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    onClick={() => handleConnect(repo)}
                    disabled={localConnectingId === repo.id || repo.isConnected}
                    variant={repo.isConnected ? "outline" : "default"}
                  >
                    {localConnectingId === repo.id
                      ? "Connecting..."
                      : repo.isConnected
                      ? "Connected"
                      : "Connect"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="text-sm font-medium">{repo.stargazers_count}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div ref={observerTarget} className="py-4">
        {isFetchingNextPage && <RepositoryListSkeleton />}
        {!hasNextPage && allRepositories.length > 0 && (
          <p className="text-center text-muted-foreground">No More Repositories</p>
        )}
      </div>
    </div>
  );
};

export default RepositoryPage;
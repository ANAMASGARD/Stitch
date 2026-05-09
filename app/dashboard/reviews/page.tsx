"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { getReviews } from "@/module/review/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { Button } from "@/components/retroui/Button";
import { Loader } from "@/components/retroui/Loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";

type ReviewItem = Awaited<ReturnType<typeof getReviews>>[number];

const getReviewPreview = (text: string, maxLength = 340) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

export default function ReviewsPage() {
  const {
    data: reviews = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => await getReviews(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">Review History</h1>
          <p className="text-muted-foreground">View all AI code reviews</p>
        </div>
        <div className="flex h-56 items-center justify-center">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-head">Review History</h1>
          <p className="text-muted-foreground">View all AI code reviews</p>
        </div>
        <Card className="w-full rounded-xl border-black">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load reviews</CardTitle>
            <CardDescription>
              {(error as Error)?.message || "An unexpected error occurred."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-head">Review History</h1>
        <p className="text-muted-foreground">View all AI code reviews</p>
      </div>

      {reviews.length === 0 ? (
        <Card className="w-full rounded-xl border-black">
          <CardHeader>
            <CardTitle>No reviews yet</CardTitle>
            <CardDescription>
              Once Stitch generates PR reviews, they will show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review: ReviewItem) => {
            const isCompleted = review.status === "completed";
            const isFailed = review.status === "failed";
            const preview = getReviewPreview(review.review);

            return (
              <Card
                key={review.id}
                className="w-full overflow-hidden rounded-xl border-black bg-card shadow-[6px_6px_0px_0px_var(--color-yellow-500)]"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="mb-0 text-lg">
                          {String(review.prNumber).padStart(2, "0")} {review.prTitle}
                        </CardTitle>
                        <Badge className="rounded-md" variant="outline">
                          PR #{review.prNumber}
                        </Badge>
                        <Badge
                          className={`rounded-md ${isCompleted ? "bg-yellow-500 text-black" : ""}`}
                          variant={isCompleted ? "solid" : isFailed ? "surface" : "default"}
                        >
                          {isCompleted ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </span>
                          ) : isFailed ? (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </span>
                          ) : (
                            "Pending"
                          )}
                        </Badge>
                      </div>
                      <CardDescription>
                        {review.repository.fullName} •{" "}
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </div>

                    <Button className="rounded-md" variant="outline" size="sm" asChild>
                      <a href={review.prUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open PR
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-lg border-2 border-yellow-500 bg-yellow-50/20 p-4">
                    <Message from="assistant">
                      <MessageContent className="w-full max-w-full bg-transparent p-0">
                      <MessageResponse className="line-clamp-5 text-sm leading-7 text-foreground/85">
                        {preview}
                      </MessageResponse>
                    </MessageContent>
                  </Message>
                  </div>

                  <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Sources>
                      <SourcesTrigger
                        className="px-0 py-0 text-yellow-600 hover:text-yellow-500"
                        count={1}
                      >
                        Source
                      </SourcesTrigger>
                      <SourcesContent>
                        <Source href={review.prUrl} title={review.prTitle} />
                      </SourcesContent>
                    </Sources>

                    <Button className="rounded-md bg-yellow-500 text-black hover:bg-yellow-400" size="sm" asChild>
                      <a href={review.prUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Full Review on GitHub
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";

export function GithubPermissionsCard() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: "github",
        callbackURL: "/dashboard/settings",
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not start GitHub re-authorization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl rounded-xl border-black">
      <CardHeader>
        <CardTitle className="text-lg">GitHub access</CardTitle>
        <CardDescription>
          Stitch needs repo and webhook permissions to connect repositories, post reviews, and run
          issue automation. If webhooks or PR actions fail after we expand permissions, re-approve once
          here — your stored GitHub token will update.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Signed in before repo or webhook scopes changed? Click to see GitHub&apos;s consent screen
          again.
        </p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-md border-2 border-black"
          disabled={loading}
          onClick={handleRefresh}
        >
          {loading ? "Redirecting…" : "Refresh GitHub permissions"}
        </Button>
      </CardContent>
    </Card>
  );
}

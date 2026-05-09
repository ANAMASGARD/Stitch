"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { Badge } from "@/components/retroui/Badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConnectedRepositories,
  disconnectRepository,
  disconnectAllRepo,
} from "@/module/settings/actions";
import { toast } from "sonner";
import { ExternalLink, Trash2, AlertTriangle } from "lucide-react";
import { Dialog as AlertDialog } from "@/components/retroui/Dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

const AlertDialogAction = Button;
const AlertDialogCancel = Button;
const AlertDialogContent = AlertDialog.Content;
const AlertDialogDescription = AlertDialog.Description;
const AlertDialogFooter = AlertDialog.Footer;
const AlertDialogHeader = AlertDialog.Header;
const AlertDialogTitle = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>;
const AlertDialogTrigger = AlertDialog.Trigger;

export function RepositoryList(){
  const queryClient = useQueryClient();

  const [disconnectedAllOpen , setDisconnectedAllOpen] = useState(false);

  const {data:repositories , isLoading} = useQuery({
    queryKey:["connected-repositories"],
    queryFn:async ()=>await getConnectedRepositories(),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })

  const disconnectMutation = useMutation({
    mutationFn:async (repositoryId:string)=>{
      return await disconnectRepository(repositoryId)
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["connected-repositories"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
        toast.success("Repository disconnected successfully")
      } else {
        toast.error(result?.message || "Failed to disconnect repository")
      }
    }
  })

  const disconnectAllMutation = useMutation({
    mutationFn: async () => {
      return await disconnectAllRepo()
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["connected-repositories"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
        toast.success(`Disconnected ${result.count} repositories`)
        setDisconnectedAllOpen(false)
      } else {
        toast.error("Failed to disconnect repositories")
      }
    },
  })

  if (isLoading) {
    return (
      <Card className="w-full max-w-5xl rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle>Connected Repositories</CardTitle>
          <CardDescription>Manage your connected GitHub repositories</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-md"></div>
            <div className="h-20 bg-muted rounded-md"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-5xl rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Connected Repositories</CardTitle>
            <CardDescription>Manage your connected GitHub repositories</CardDescription>
          </div>
          {repositories && repositories.length > 0 && (
            <AlertDialog open={disconnectedAllOpen} onOpenChange={setDisconnectedAllOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm" className="w-auto self-start rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Disconnect All Repositories?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect all {repositories.length} repositories and delete all associated AI reviews.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel variant="outline" onClick={() => setDisconnectedAllOpen(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="default"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => disconnectAllMutation.mutate()}
                    disabled={disconnectAllMutation.isPending}
                  >
                    {disconnectAllMutation.isPending ? "Disconnecting..." : "Disconnect All"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {!repositories || repositories.length === 0 ? (
          <div className="text-sm text-muted-foreground">No repositories connected yet.</div>
        ) : (
          <div className="space-y-3">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="flex flex-col gap-3 rounded-lg border-2 border-border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{repo.fullName}</p>
                    <Badge variant="outline" size="sm">Connected</Badge>
                  </div>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline break-all"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {repo.url}
                  </a>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm" className="w-auto self-start rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:self-auto">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Disconnect Repository?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect <strong>{repo.fullName}</strong> and remove associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="default"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => disconnectMutation.mutate(repo.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

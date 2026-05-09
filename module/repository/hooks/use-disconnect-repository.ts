"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { disconnectRepository } from "../actions";
import { toast } from "sonner";

export const useDisconnectRepository = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ githubId }: { githubId: number }) => {
            return await disconnectRepository(githubId);
        },
        onSuccess: () => {
            toast.success("Repository disconnected successfully");
            queryClient.invalidateQueries({ queryKey: ["repositories"] });
        },
        onError: (error) => {
            toast.error("Failed to disconnect repository");
            console.error(error);
        }
    });
};

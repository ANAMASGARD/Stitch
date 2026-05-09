import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";
import { indexCodebase } from "@/module/ai/lib/rag";
import { getRepoFileContent } from "@/module/github/lib/github";

export const indexRepo = inngest.createFunction(
  { id: "index-repo", triggers: [{ event: "repository.connected" }] },
  async ({ event, step }) => {
    const { owner, repo, userId } = event.data as {
      owner: string;
      repo: string;
      userId: string;
    };

    const normalizedOwner = owner?.trim();
    const normalizedRepo = repo?.trim();
    const normalizedUserId = userId?.trim();

    if (!normalizedOwner || !normalizedRepo || !normalizedUserId) {
      throw new Error(
        `Invalid repository.connected payload: owner="${owner ?? ""}", repo="${repo ?? ""}", userId="${userId ?? ""}"`
      );
    }

    const fetchResult = await step.run("fetch-files", async () => {
      const account = await prisma.account.findFirst({
        where: {
          userId: normalizedUserId,
          providerId: "github",
        },
      });

      if (!account?.accessToken) {
        throw new Error("No GitHub access token found");
      }

      const files = await getRepoFileContent(
        account.accessToken,
        normalizedOwner,
        normalizedRepo
      );

      return {
        owner: normalizedOwner,
        repo: normalizedRepo,
        fullName: `${normalizedOwner}/${normalizedRepo}`,
        fileCount: files.length,
        samplePaths: files.slice(0, 5).map((file) => file.path),
        files,
      };
    });

    const indexResult = await step.run("index-codebase", async () => {
      return await indexCodebase(fetchResult.fullName, fetchResult.files);
    });

    return {
      success: true,
      owner: fetchResult.owner,
      repo: fetchResult.repo,
      fullName: fetchResult.fullName,
      fetchedFiles: fetchResult.fileCount,
      indexedFiles: indexResult.indexedFiles,
      chunkCount: indexResult.chunkCount,
      embeddingBatchCount: indexResult.embeddingBatchCount,
      upsertBatchCount: indexResult.upsertBatchCount,
      samplePaths: fetchResult.samplePaths,
      message: `Indexed ${indexResult.indexedFiles} files from ${fetchResult.fullName} into Pinecone.`,
    };
  }
);
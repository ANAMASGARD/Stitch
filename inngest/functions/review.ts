import { inngest } from "../client";
import { getPullRequestDiff, postReviewComment } from "@/module/github/lib/github";
import { retrieveContext } from "@/module/ai/lib/rag";
import {
  formatRagContextForReview,
  generatePrReviewMarkdown,
} from "@/module/ai/lib/pr-review-llm";
import prisma from "@/lib/db";

export const generateReview = inngest.createFunction(
  { id: "generate-review", concurrency: 5, triggers: [{ event: "pr.review.requested" }] },
  async ({ event, step }) => {
    const payload = event.data as {
      owner: string;
      repo: string;
      prNumber: number;
      userId: string;
    };
    const { owner, repo, prNumber, userId } = payload;

    const { diff, title, description, githubThreadContext, token } =
      await step.run("fetch-pr-data", async () => {
        const account = await prisma.account.findFirst({
          where: {
            userId: userId,
            providerId: "github",
          },
        });

        if (!account?.accessToken) {
          throw new Error("No GitHub access token found");
        }

        const data = await getPullRequestDiff(
          account.accessToken,
          owner,
          repo,
          prNumber,
        );
        return { ...data, token: account.accessToken };
      });

    const context = await step.run("retrieve-context", async () => {
      const query = `${title}\n${description}`;

      return await retrieveContext(query, `${owner}/${repo}`);
    });

    const review = await step.run("generate-ai-review", async () => {
      const contextFromCodebase = formatRagContextForReview(context);
      return await generatePrReviewMarkdown({
        title,
        description: description || "",
        diff,
        contextFromCodebase,
        githubThreadContext,
      });
    });

    await step.run("post-comment", async () => {
      await postReviewComment(token, owner, repo, prNumber, review);
    });

    await step.run("save-review", async () => {
      const repository = await prisma.repository.findFirst({
        where: {
          owner,
          name: repo,
        },
      });

      if (repository) {
        await prisma.review.create({
          data: {
            repositoryId: repository.id,
            prNumber,
            prTitle: title,
            prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
            review,
            status: "completed",
          },
        });
      }
    });

    return { success: true };
  }
);

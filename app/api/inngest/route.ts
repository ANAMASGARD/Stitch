import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { indexRepo } from "../../../inngest/functions";
import {
  analyzeIssue,
  createIssueFixPullRequest,
} from "../../../inngest/functions/issue";
import { generateReview } from "../../../inngest/functions/review";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    indexRepo,
    generateReview,
    analyzeIssue,
    createIssueFixPullRequest,
  ],
});


import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { indexRepo } from "../../../inngest/functions";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [indexRepo],
});


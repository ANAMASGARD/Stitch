import { inngest } from "@/inngest/client";

export const processTask = inngest.createFunction(
  { id: "process-task", triggers: [{ event: "app/task.created" }] },
  async ({ event, step }) => {
    const taskId = (event.data as { id?: string | number } | undefined)?.id ?? "unknown";
    const result = await step.run("handle-task", async () => {
      return { processed: true, id: taskId };
    });

    await step.sleep("pause", "1s");

    return { message: `Task ${taskId} complete`, result };
  }
);
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { buildRepositoryChatSystemPrompt } from "@/module/ai/lib/repository-chat-llm";
import { hasIndexedCodebase, indexCodebase, retrieveContext } from "@/module/ai/lib/rag";
import { buildChatSessionTitleFromFirstUserMessage } from "@/module/chat/lib/session-title";
import {
  getLastUserUIMessage,
  getTextFromUIMessage,
} from "@/module/chat/lib/ui-message-text";
import { getRepoFileContent } from "@/module/github/lib/github";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const chatRequestSchema = z.object({
  id: z.string().optional(),
  repositoryId: z.string().min(1),
  sessionId: z.string().min(1),
  messages: z.array(z.record(z.string(), z.unknown())),
  trigger: z.enum(["submit-message", "regenerate-message"]),
  messageId: z.string().optional(),
});

function stripIdsForModel(
  messages: Array<Record<string, unknown>>,
): Omit<UIMessage, "id">[] {
  return messages.map((m) => {
    const { id, ...rest } = m as unknown as UIMessage;
    void id;
    return rest as Omit<UIMessage, "id">;
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { repositoryId, sessionId, messages, trigger } = parsed.data;

  const [repository, chatSessionRow] = await Promise.all([
    prisma.repository.findFirst({
      where: { id: repositoryId, userId },
      select: { id: true, fullName: true, owner: true, name: true },
    }),
    prisma.chatSession.findFirst({
      where: { id: sessionId, userId, repositoryId },
      select: { id: true },
    }),
  ]);

  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }
  if (!chatSessionRow) {
    if (trigger !== "submit-message") {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    try {
      await prisma.chatSession.create({
        data: {
          id: sessionId,
          userId,
          repositoryId,
          title: "New chat",
        },
      });
    } catch (e) {
      console.error("[chat] failed to recover missing chat session", e);
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
  }

  const repoFullNameForRag = repository.fullName;
  const uiMessages = messages as unknown as UIMessage[];
  const lastUser = getLastUserUIMessage(uiMessages);
  if (!lastUser) {
    return NextResponse.json({ error: "Missing user message" }, { status: 400 });
  }

  const ragQuery = getTextFromUIMessage(lastUser);
  let chunks: Awaited<ReturnType<typeof retrieveContext>> = [];
  try {
    chunks = await retrieveContext(ragQuery, repoFullNameForRag, 8);
  } catch (e) {
    console.error("[chat] retrieveContext failed; continuing without RAG", e);
  }

  if (chunks.length === 0) {
    const alreadyIndexed = await hasIndexedCodebase(repoFullNameForRag);
    if (!alreadyIndexed) {
      try {
        const account = await prisma.account.findFirst({
          where: { userId, providerId: "github" },
          select: { accessToken: true },
        });

        if (account?.accessToken) {
          console.info(`[chat] indexing ${repoFullNameForRag} before answering`);
          const files = await getRepoFileContent(
            account.accessToken,
            repository.owner,
            repository.name,
          );
          await indexCodebase(repoFullNameForRag, files);
          chunks = await retrieveContext(ragQuery, repoFullNameForRag, 8);
        } else {
          console.warn(`[chat] cannot index ${repoFullNameForRag}: missing GitHub token`);
        }
      } catch (e) {
        console.error("[chat] on-demand repository indexing failed", e);
      }
    }
  }

  const system = buildRepositoryChatSystemPrompt({
    repoFullName: repoFullNameForRag,
    ragChunks: chunks,
  });

  if (trigger === "submit-message") {
    try {
      await prisma.chatMessage.upsert({
        where: {
          sessionId_clientMessageId: {
            sessionId,
            clientMessageId: lastUser.id,
          },
        },
        create: {
          sessionId,
          role: "user",
          content: ragQuery,
          clientMessageId: lastUser.id,
        },
        update: {},
      });
    } catch (e) {
      console.error("[chat] user message upsert", e);
    }
  }

  const modelMessages = await convertToModelMessages(stripIdsForModel(messages));

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is required for repository chat." },
      { status: 500 },
    );
  }

  const openrouter = createOpenRouter({ apiKey: openrouterKey });

  const result = streamText({
    model: openrouter("qwen/qwen3.5-flash-02-23"),
    system,
    messages: modelMessages,
    async onFinish(event) {
      const text = event.text;
      try {
        await prisma.chatMessage.create({
          data: {
            sessionId,
            role: "assistant",
            content: text,
            clientMessageId: null,
          },
        });

        const sessionRow = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: { title: true },
        });
        if (sessionRow?.title === "New chat") {
          const firstUser = uiMessages.find((m) => m.role === "user");
          const firstUserText = firstUser
            ? getTextFromUIMessage(firstUser)
            : "";
          if (firstUserText.trim()) {
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: {
                title: buildChatSessionTitleFromFirstUserMessage(firstUserText),
              },
            });
          }
        }
      } catch (e) {
        console.error("[chat] onFinish persist", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const CHAT_PRISMA_WARN =
  "[Stitch] Prisma client is missing ChatSession / ChatMessage — run `npx prisma migrate dev`, `npx prisma generate`, and restart the dev server.";

function getChatModels():
  | {
      chatSession: typeof prisma.chatSession;
      chatMessage: typeof prisma.chatMessage;
    }
  | null {
  const chatSession = (
    prisma as unknown as { chatSession?: typeof prisma.chatSession }
  ).chatSession;
  const chatMessage = (
    prisma as unknown as { chatMessage?: typeof prisma.chatMessage }
  ).chatMessage;
  if (
    !chatSession ||
    typeof chatSession.findMany !== "function" ||
    typeof chatSession.create !== "function" ||
    !chatMessage ||
    typeof chatMessage.findMany !== "function"
  ) {
    console.warn(CHAT_PRISMA_WARN);
    return null;
  }
  return { chatSession, chatMessage };
}

async function requireSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function getConnectedRepositoriesForChat() {
  try {
    const userId = await requireSessionUserId();
    return await prisma.repository.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        owner: true,
        fullName: true,
        url: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function getChatSessionsForRepository(repositoryId: string) {
  const models = getChatModels();
  if (!models) return [];

  const userId = await requireSessionUserId();
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, userId },
    select: { id: true },
  });
  if (!repo) return [];

  try {
    return await models.chatSession.findMany({
      where: { repositoryId, userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("[getChatSessionsForRepository]", e);
    return [];
  }
}

export async function createChatSession(repositoryId: string) {
  const models = getChatModels();
  if (!models) {
    throw new Error(
      "Chat storage is not ready. Run `npx prisma migrate dev`, `npx prisma generate`, then restart the dev server."
    );
  }

  const userId = await requireSessionUserId();
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, userId },
    select: { id: true },
  });
  if (!repo) {
    throw new Error("Repository not found");
  }

  const session = await models.chatSession.create({
    data: {
      userId,
      repositoryId,
      title: "New chat",
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  revalidatePath("/dashboard/chat", "page");
  return session;
}

export async function getChatMessagesForSession(sessionId: string) {
  const models = getChatModels();
  if (!models) return [];

  const userId = await requireSessionUserId();
  const session = await models.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) return [];

  try {
    return await models.chatMessage.findMany({
      where: { sessionId },
      select: {
        id: true,
        role: true,
        content: true,
        clientMessageId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (e) {
    console.error("[getChatMessagesForSession]", e);
    return [];
  }
}

export async function deleteChatSession(sessionId: string) {
  const models = getChatModels();
  if (!models) return;

  const userId = await requireSessionUserId();
  try {
    await models.chatSession.deleteMany({
      where: { id: sessionId, userId },
    });
    revalidatePath("/dashboard/chat", "page");
  } catch (e) {
    console.error("[deleteChatSession]", e);
  }
}

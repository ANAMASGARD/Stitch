"use server";

import {auth} from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deleteWebhook } from "@/module/github/lib/github";

export async function getUserProfile() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
     console.log("Error getting user profile", error);
     return null;
  }
}


export async function updateUserProfile(data:{name?:string; email?:string}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const updateUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        name: data.name,
        email: data.email
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    revalidatePath("/dashboard/settings","page");
    return { success: true, user: updateUser ,message: "User profile updated successfully" };
  } catch (error) {
    console.log("Error updating user profile", error);
    return { success: false, message: "Failed to update user profile" };
  }
}

export async function getConnectedRepositories(){
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repositories = await prisma.repository.findMany({
      where:{userId:session.user.id},
      select: {
        id: true,
        name: true,
        owner: true,
        fullName: true,
        url: true,
        createdAt: true,
        updatedAt: true,
        githubId: true,
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return repositories
  } catch (error) {
    console.log("Error getting connected repositories", error)
    return []
  }
}

export async function disconnectRepository(repositoryId:string){
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repository = await prisma.repository.findUnique({
      where:{
        id:repositoryId,
        userId:session.user.id
      }
    })

    if (!repository) {
      return { success: false, message: "Repository not found" };
    }

    await deleteWebhook(repository.owner, repository.name)

    await prisma.repository.delete({
      where: {
        id: repositoryId,
        userId:session.user.id,
      }
    });
    revalidatePath("/dashboard/settings","page");
    revalidatePath("/dashboard/repositories","page");

    return { success: true, message: "Repository disconnected successfully" };
  } catch (error) {
    console.log("Error disconnecting repository", error)
    return { success: false, message: "Failed to disconnect repository" };
  }
}

export async function disconnectAllRepo(){
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repositories = await prisma.repository.findMany({
      where: {
        userId: session.user.id,
      },
    })

    await Promise.all(repositories.map(async (repo)=>{
      await deleteWebhook(repo.owner , repo.name)
    }));

    // Delete all repositories
    const result = await prisma.repository.deleteMany({
      where: {
        userId: session.user.id,
      }
    });

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/repository")

    return { success: true, count: result.count };
  } catch (error) {
    console.log("Error disconnecting all repositories", error)
    return { success: false, count: 0 };
  }
}

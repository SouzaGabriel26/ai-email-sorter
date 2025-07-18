"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CreateCategoryInput, createCategorySchema } from "../schemas/category";

export type Category = {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    emails: number;
  };
};

export async function createCategoryAction(input: CreateCategoryInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      throw new Error("Unauthorized");
    }

    // Validate input
    const validatedInput = createCategorySchema.parse(input);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if category name already exists for this user
    const existingCategory = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: {
          equals: validatedInput.name,
          mode: "insensitive", // Case-insensitive check
        },
      },
    });

    if (existingCategory) {
      throw new Error("Category with this name already exists");
    }

    // Create the category
    const category = await prisma.category.create({
      data: {
        name: validatedInput.name,
        description: validatedInput.description,
        userId: user.id,
      },
    });

    // Revalidate the dashboard to refresh stats
    revalidatePath("/dashboard");

    return { success: true, category };
  } catch (error) {
    console.error("Create category error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

export async function getCategoriesAction() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return [];
    }

    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { emails: true },
        },
      },
    });

    return categories;
  } catch (error) {
    console.error("Get categories error:", error);
    return [];
  }
}

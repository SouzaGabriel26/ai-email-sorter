process.env.GOOGLE_AI_API_KEY = "test-key";

// Mock all server-only modules before imports
jest.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    email: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import {
  createCategoryAction,
  getCategoriesAction,
} from "../app/actions/categories";
import { prisma } from "../lib/prisma";

const mockUser = { id: "user1", email: "test@example.com" };

describe("Category Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: mockUser.email },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
  });

  it("should add a new category", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.category.create as jest.Mock).mockResolvedValue({
      id: "cat1",
      name: "Work",
      description: "Work stuff",
      userId: "user1",
    });
    const result = await createCategoryAction({
      name: "Work",
      description: "Work stuff",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.category!.name).toBe("Work");
    }
  });

  it("should not add duplicate category for same user", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({
      id: "cat1",
      name: "Work",
      userId: "user1",
    });
    const result = await createCategoryAction({
      name: "Work",
      description: "Work stuff",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });

  it("should validate category name is required", async () => {
    const result = await createCategoryAction({
      name: "",
      description: "desc",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it("should handle DB errors gracefully", async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.category.create as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );
    const result = await createCategoryAction({
      name: "Err",
      description: "desc long enough",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/DB error/);
  });

  it("should list categories for a user", async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: "cat1", name: "Work", description: "Work stuff", userId: "user1" },
      {
        id: "cat2",
        name: "Personal",
        description: "Personal stuff",
        userId: "user1",
      },
    ]);
    const categories = await getCategoriesAction();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].name).toBe("Work");
  });
});

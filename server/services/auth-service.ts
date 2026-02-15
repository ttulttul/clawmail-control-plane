import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { users } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

export async function registerUser(
  db: DatabaseClient,
  input: { email: string; password: string },
): Promise<{ userId: string }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "User with this email already exists.",
    });
  }

  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email: input.email,
    passwordHash: hashPassword(input.password),
  });

  return { userId };
}

export async function authenticateUser(
  db: DatabaseClient,
  input: { email: string; password: string },
): Promise<{ userId: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    });
  }

  return { userId: user.id };
}

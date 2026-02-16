import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { castMemberships, casts } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";

const roleRank = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
} as const;

type Role = keyof typeof roleRank;
export type CastRole = Role;

export async function createCastForUser(
  db: DatabaseClient,
  input: { userId: string; name: string; role?: Role },
): Promise<{ castId: string }> {
  const castId = createId();
  const membershipId = createId();

  db.transaction((tx) => {
    tx
      .insert(casts)
      .values({
        id: castId,
        name: input.name,
      })
      .run();

    tx
      .insert(castMemberships)
      .values({
        id: membershipId,
        castId,
        userId: input.userId,
        role: input.role ?? "owner",
      })
      .run();
  });

  return { castId };
}

export async function listCastsForUser(
  db: DatabaseClient,
  userId: string,
): Promise<Array<{ id: string; name: string; role: Role }>> {
  const rows = await db
    .select({
      id: casts.id,
      name: casts.name,
      role: castMemberships.role,
    })
    .from(castMemberships)
    .innerJoin(casts, eq(castMemberships.castId, casts.id))
    .where(eq(castMemberships.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
}

export async function requireCastMembership(
  db: DatabaseClient,
  input: {
    userId: string;
    castId: string;
    minimumRole?: Role;
  },
): Promise<{ role: Role }> {
  const membership = await db.query.castMemberships.findFirst({
    where: and(
      eq(castMemberships.userId, input.userId),
      eq(castMemberships.castId, input.castId),
    ),
  });

  if (!membership) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not a member of this cast.",
    });
  }

  if (
    input.minimumRole &&
    roleRank[membership.role] < roleRank[input.minimumRole]
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This action requires ${input.minimumRole} privileges.`,
    });
  }

  return { role: membership.role };
}

import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { riskMemberships, risks } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";

const roleRank = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
} as const;

type Role = keyof typeof roleRank;
export type RiskRole = Role;

export async function createRiskForUser(
  db: DatabaseClient,
  input: { userId: string; name: string; role?: Role },
): Promise<{ riskId: string }> {
  const riskId = createId();
  const membershipId = createId();

  db.transaction((tx) => {
    tx
      .insert(risks)
      .values({
        id: riskId,
        name: input.name,
      })
      .run();

    tx
      .insert(riskMemberships)
      .values({
        id: membershipId,
        riskId,
        userId: input.userId,
        role: input.role ?? "owner",
      })
      .run();
  });

  return { riskId };
}

export async function listRisksForUser(
  db: DatabaseClient,
  userId: string,
): Promise<Array<{ id: string; name: string; role: Role }>> {
  const rows = await db
    .select({
      id: risks.id,
      name: risks.name,
      role: riskMemberships.role,
    })
    .from(riskMemberships)
    .innerJoin(risks, eq(riskMemberships.riskId, risks.id))
    .where(eq(riskMemberships.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
}

export async function requireRiskMembership(
  db: DatabaseClient,
  input: {
    userId: string;
    riskId: string;
    minimumRole?: Role;
  },
): Promise<{ role: Role }> {
  const membership = await db.query.riskMemberships.findFirst({
    where: and(
      eq(riskMemberships.userId, input.userId),
      eq(riskMemberships.riskId, input.riskId),
    ),
  });

  if (!membership) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not a member of this risk.",
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

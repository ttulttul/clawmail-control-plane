import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { tenantMemberships, tenants } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";

const roleRank = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
} as const;

type Role = keyof typeof roleRank;
export type TenantRole = Role;

export async function createTenantForUser(
  db: DatabaseClient,
  input: { userId: string; name: string; role?: Role },
): Promise<{ tenantId: string }> {
  const tenantId = createId();
  const membershipId = createId();

  db.transaction((tx) => {
    tx
      .insert(tenants)
      .values({
        id: tenantId,
        name: input.name,
      })
      .run();

    tx
      .insert(tenantMemberships)
      .values({
        id: membershipId,
        tenantId,
        userId: input.userId,
        role: input.role ?? "owner",
      })
      .run();
  });

  return { tenantId };
}

export async function listTenantsForUser(
  db: DatabaseClient,
  userId: string,
): Promise<Array<{ id: string; name: string; role: Role }>> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
}

export async function requireTenantMembership(
  db: DatabaseClient,
  input: {
    userId: string;
    tenantId: string;
    minimumRole?: Role;
  },
): Promise<{ role: Role }> {
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.userId, input.userId),
      eq(tenantMemberships.tenantId, input.tenantId),
    ),
  });

  if (!membership) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not a member of this tenant.",
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

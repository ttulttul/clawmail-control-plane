import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia } from "lucia";

import { sessions, users } from "../../drizzle/schema.js";
import { db } from "../lib/db.js";

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  },
  getUserAttributes: (attributes) => ({
    email: attributes.email,
  }),
});

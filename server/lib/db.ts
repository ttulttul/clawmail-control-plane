import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";

import * as schema from "../../drizzle/schema.js";
import { env } from "./env.js";
import { ensureSqliteDatabaseDirectory } from "./sqlite-path.js";

ensureSqliteDatabaseDirectory(env.DATABASE_URL);
const sqlite = new Database(env.DATABASE_URL);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export type DatabaseClient = typeof db;

migrate(db, {
  migrationsFolder: join(process.cwd(), "drizzle/migrations"),
});

export function closeDatabase(): void {
  sqlite.close();
}

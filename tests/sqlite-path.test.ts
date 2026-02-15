/* @vitest-environment node */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import { ensureSqliteDatabaseDirectory } from "../server/lib/sqlite-path";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("ensureSqliteDatabaseDirectory", () => {
  test("creates missing parent directory for relative database paths", () => {
    const root = mkdtempSync(join(tmpdir(), "clawmail-sqlite-path-"));
    createdRoots.push(root);

    const databasePath = "data/clawmail.db";
    const expectedDirectory = join(root, "data");

    expect(existsSync(expectedDirectory)).toBe(false);

    ensureSqliteDatabaseDirectory(databasePath, root);

    expect(existsSync(expectedDirectory)).toBe(true);
  });

  test("does not create directories for in-memory sqlite", () => {
    const root = mkdtempSync(join(tmpdir(), "clawmail-sqlite-memory-"));
    createdRoots.push(root);

    ensureSqliteDatabaseDirectory(":memory:", root);

    expect(existsSync(join(root, "data"))).toBe(false);
  });
});

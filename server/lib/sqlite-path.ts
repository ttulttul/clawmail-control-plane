import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function isInMemoryDatabase(databaseUrl: string): boolean {
  const normalized = databaseUrl.toLowerCase();
  return (
    normalized === ":memory:" ||
    normalized === "file::memory:" ||
    normalized.startsWith("file::memory:") ||
    normalized.includes("mode=memory")
  );
}

function toFilesystemPath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  try {
    return fileURLToPath(new URL(databaseUrl));
  } catch {
    return null;
  }
}

export function ensureSqliteDatabaseDirectory(
  databaseUrl: string,
  cwd: string = process.cwd(),
): void {
  if (isInMemoryDatabase(databaseUrl)) {
    return;
  }

  const filePath = toFilesystemPath(databaseUrl);
  if (!filePath) {
    return;
  }

  const parentDirectory = dirname(filePath);
  if (parentDirectory === "." || parentDirectory === "") {
    return;
  }

  const absoluteDirectory = isAbsolute(parentDirectory)
    ? parentDirectory
    : resolve(cwd, parentDirectory);

  mkdirSync(absoluteDirectory, { recursive: true });
}

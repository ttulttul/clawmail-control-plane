function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getIssuePath(path: unknown): string | null {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  const segments = path
    .filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number",
    )
    .map(String);

  return segments.length > 0 ? segments.join(".") : null;
}

function parseIssue(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const message = value.message;
  if (typeof message !== "string" || message.length === 0) {
    return null;
  }

  const path = getIssuePath(value.path);
  return path ? `${path}: ${message}` : message;
}

export function formatAuthErrorMessage(message: string): string[] {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return ["Something went wrong while processing this request."];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [trimmed];
    }

    const details = parsed
      .map((entry) => parseIssue(entry))
      .filter((entry): entry is string => entry !== null);

    return details.length > 0 ? details : [trimmed];
  } catch {
    return [trimmed];
  }
}

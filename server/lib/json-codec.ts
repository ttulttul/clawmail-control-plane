function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeJson<T>(
  rawValue: string | null | undefined,
  guard: (value: unknown) => value is T,
  fallback: T,
): T {
  if (typeof rawValue !== "string") {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function parseStringArray(rawValue: string | null | undefined): string[] {
  const parsed = safeJson(rawValue, isJsonArray, []);
  return parsed.filter((value): value is string => typeof value === "string");
}

export function parseRecord(
  rawValue: string | null | undefined,
): Record<string, unknown> {
  return safeJson(rawValue, isJsonRecord, {});
}

export function safeJsonStringify(value: unknown, fallback: string): string {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

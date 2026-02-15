/* @vitest-environment node */

import { describe, expect, test } from "vitest";

import {
  parseRecord,
  parseStringArray,
  safeJson,
  safeJsonStringify,
} from "../server/lib/json-codec";

describe("json-codec", () => {
  test("parseStringArray filters non-string entries", () => {
    expect(parseStringArray('["a",1,"b",true]')).toEqual(["a", "b"]);
  });

  test("parseStringArray returns fallback on invalid json", () => {
    expect(parseStringArray("not-json")).toEqual([]);
  });

  test("parseRecord returns object values and handles invalid payloads", () => {
    expect(parseRecord('{"key":"value"}')).toEqual({ key: "value" });
    expect(parseRecord("[1,2,3]")).toEqual({});
    expect(parseRecord("not-json")).toEqual({});
  });

  test("safeJson validates via guard before returning parsed value", () => {
    const parsed = safeJson(
      '{"feature":true}',
      (value): value is { feature: boolean } =>
        typeof value === "object" &&
        value !== null &&
        "feature" in value &&
        typeof value.feature === "boolean",
      { feature: false },
    );

    expect(parsed).toEqual({ feature: true });
  });

  test("safeJsonStringify uses fallback when value cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(safeJsonStringify(circular, "{}")).toBe("{}");
    expect(safeJsonStringify(undefined, "[]")).toBe("[]");
  });
});

import { describe, expect, it } from "vitest";
import { MAX_NOTIFICATION_IDS_PER_CALL, sanitizeNotificationIds } from "./ids";

const A = "6129dde3-c581-4577-871f-b3bf9c6a0f44";
const B = "00000000-0000-0000-0000-0000000000f1";

describe("sanitizeNotificationIds", () => {
  it("keeps valid UUIDs in order", () => {
    expect(sanitizeNotificationIds([A, B])).toEqual([A, B]);
  });

  it("lowercases and removes duplicates", () => {
    expect(sanitizeNotificationIds([A.toUpperCase(), A, B])).toEqual([A, B]);
  });

  it("drops anything that is not a well-formed UUID string", () => {
    expect(
      sanitizeNotificationIds([
        A,
        "not-a-uuid",
        "",
        `${A}; drop table notifications`,
        `${A},${B}`,
        42,
        null,
        undefined,
        { id: A },
      ])
    ).toEqual([A]);
  });

  it("returns an empty list for non-array input", () => {
    expect(sanitizeNotificationIds(undefined)).toEqual([]);
    expect(sanitizeNotificationIds(null)).toEqual([]);
    expect(sanitizeNotificationIds(A)).toEqual([]);
    expect(sanitizeNotificationIds({ 0: A })).toEqual([]);
  });

  it("caps the number of ids per call", () => {
    const many = Array.from(
      { length: MAX_NOTIFICATION_IDS_PER_CALL + 25 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`
    );
    expect(sanitizeNotificationIds(many)).toHaveLength(MAX_NOTIFICATION_IDS_PER_CALL);
  });
});

import { describe, expect, it, vi } from "vitest";
import { toSafeErrorMessage } from "./safe-message.server";

// This function is the single choke point that is supposed to stop raw
// Postgres/Supabase error text (constraint names, schema names) from ever
// reaching the browser. See docs/production-readiness-report.md — a Server
// Action that bypasses this (interpolates error.message directly) was found
// and fixed in app/dashboard/users/actions.ts during this review.
describe("toSafeErrorMessage", () => {
  it("replaces a generic Postgres error with the fallback message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pgError = {
      message: 'duplicate key value violates unique constraint "profiles_email_key"',
      code: "23505",
    };
    const result = toSafeErrorMessage(pgError, "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง", "test");
    expect(result).toBe("ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง");
    expect(result).not.toContain("constraint");
    expect(result).not.toContain("profiles_email_key");
  });

  it("passes through the raw message only for the app's own P0001 errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const appError = {
      message: "ไม่สามารถถอดถอน Super Admin คนสุดท้ายได้",
      code: "P0001",
    };
    const result = toSafeErrorMessage(appError, "เกิดข้อผิดพลาด", "test");
    expect(result).toBe("ไม่สามารถถอดถอน Super Admin คนสุดท้ายได้");
  });

  it("falls back safely for a plain Error with no Postgres code", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toSafeErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:5432"), "เกิดข้อผิดพลาด กรุณาลองใหม่", "test");
    expect(result).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่");
    expect(result).not.toContain("ECONNREFUSED");
  });

  it("falls back safely for null/undefined/non-object errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toSafeErrorMessage(null, "fallback", "test")).toBe("fallback");
    expect(toSafeErrorMessage(undefined, "fallback", "test")).toBe("fallback");
    expect(toSafeErrorMessage("some raw string", "fallback", "test")).toBe("fallback");
  });

  it("logs the real error server-side even when masking it from the caller", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    toSafeErrorMessage({ message: "raw detail", code: "42501" }, "fallback", "myAction");
    expect(spy).toHaveBeenCalledWith("myAction:", "raw detail", "(code: 42501)");
    spy.mockRestore();
  });
});

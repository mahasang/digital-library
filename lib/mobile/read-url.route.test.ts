import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests ของ route handler GET /api/mobile/research/[slug]/read-url —
 * พิสูจน์ลำดับด่าน: ตั้งค่าระบบ → token → slug → ยืนยันตัวตน → rate limit →
 * ตรวจสิทธิ์/สร้างลิงก์ (ด่านหลังจะไม่ถูกเรียกถ้าด่านก่อนหน้าไม่ผ่าน)
 */

const isSupabaseConfiguredMock = vi.fn();
const isServiceRoleConfiguredMock = vi.fn();
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => isSupabaseConfiguredMock(),
  isServiceRoleConfigured: () => isServiceRoleConfiguredMock(),
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit.server", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  rateLimitKeyForUser: (action: string, userId: string) => `${action}:${userId}`,
}));

const authenticateBearerMock = vi.fn();
const getMobileReadUrlMock = vi.fn();
vi.mock("@/lib/mobile/read-url.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mobile/read-url.server")>();
  return {
    ...actual,
    authenticateBearer: (...args: unknown[]) => authenticateBearerMock(...args),
    getMobileReadUrl: (...args: unknown[]) => getMobileReadUrlMock(...args),
  };
});

vi.mock("@/lib/storage/signed-url.server", () => ({
  getResearchReadUrl: vi.fn(),
}));

import { GET } from "@/app/api/mobile/research/[slug]/read-url/route";

const rpcMock = vi.fn();

function call(slug: string, headers: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost/api/mobile/research/${slug}/read-url`, {
    headers,
  });
  return GET(request, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  isSupabaseConfiguredMock.mockReset().mockReturnValue(true);
  isServiceRoleConfiguredMock.mockReset().mockReturnValue(true);
  checkRateLimitMock.mockReset().mockResolvedValue({ allowed: true });
  authenticateBearerMock
    .mockReset()
    .mockResolvedValue({ client: { rpc: rpcMock }, userId: "user-1" });
  getMobileReadUrlMock.mockReset().mockResolvedValue({ ok: true, url: "https://signed.example/x" });
  rpcMock.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/mobile/research/[slug]/read-url", () => {
  it("returns 503 when Supabase / the service role is not configured", async () => {
    isServiceRoleConfiguredMock.mockReturnValue(false);
    const res = await call("s", { authorization: "Bearer tok" });
    expect(res.status).toBe(503);
    expect(authenticateBearerMock).not.toHaveBeenCalled();
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await call("s");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(authenticateBearerMock).not.toHaveBeenCalled();
    expect(getMobileReadUrlMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is rejected by Supabase Auth", async () => {
    authenticateBearerMock.mockResolvedValue(null);
    const res = await call("s", { authorization: "Bearer bad" });
    expect(res.status).toBe(401);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(getMobileReadUrlMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an over-long slug before authenticating", async () => {
    const res = await call("a".repeat(201), { authorization: "Bearer tok" });
    expect(res.status).toBe(404);
    expect(authenticateBearerMock).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the per-user rate limit is hit", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false });
    const res = await call("s", { authorization: "Bearer tok" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(checkRateLimitMock).toHaveBeenCalledWith("mobile-read-url:user-1", 30, 60);
    expect(getMobileReadUrlMock).not.toHaveBeenCalled();
  });

  it("maps a denied read to its status and machine-readable code", async () => {
    getMobileReadUrlMock.mockResolvedValue({ ok: false, status: 403, code: "read_not_allowed" });
    const res = await call("s", { authorization: "Bearer tok" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "read_not_allowed" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns only the url, never cached, and logs reading history", async () => {
    const res = await call("my-slug", { authorization: "Bearer tok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://signed.example/x" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getMobileReadUrlMock).toHaveBeenCalledWith(expect.anything(), "user-1", "my-slug");
    expect(rpcMock).toHaveBeenCalledWith("log_reading_history", { p_slug: "my-slug" });
  });

  it("still returns the url when logging reading history fails", async () => {
    rpcMock.mockResolvedValue({ error: { message: "history down" } });
    const res = await call("s", { authorization: "Bearer tok" });
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://signed.example/x");
  });
});

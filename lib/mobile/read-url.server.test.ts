import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Unit tests ของ lib/mobile/read-url.server.ts (endpoint ให้แอปมือถือขอ
 * Signed URL อ่านออนไลน์) — mock ทั้ง Supabase client และ getResearchReadUrl
 * เพื่อพิสูจน์ "ลำดับการตรวจสิทธิ์" โดยไม่ต้องต่อ Supabase จริง
 */

const readUrlMock = vi.fn();
vi.mock("@/lib/storage/signed-url.server", () => ({
  getResearchReadUrl: (...args: unknown[]) => readUrlMock(...args),
}));

import {
  extractBearerToken,
  getMobileReadUrl,
  isValidSlug,
} from "@/lib/mobile/read-url.server";

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

function makeChain(result: FakeResult) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "or", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}

function makeClient(opts: {
  item?: Record<string, unknown> | null;
  itemError?: { message: string } | null;
  grant?: Record<string, unknown> | null;
  grantError?: { message: string } | null;
}) {
  const itemChain = makeChain({ data: opts.item ?? null, error: opts.itemError ?? null });
  const grantChain = makeChain({ data: opts.grant ?? null, error: opts.grantError ?? null });
  const client = {
    from: vi.fn((table: string) => (table === "research_items" ? itemChain : grantChain)),
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    itemChain,
    grantChain,
  };
}

const publicItem = {
  id: "item-uuid-1",
  access_level: "public",
  pdf_file: "owner-1/paper.pdf",
  scan_status: "clean",
};

beforeEach(() => {
  readUrlMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("extractBearerToken", () => {
  it("reads a well-formed bearer token", () => {
    expect(extractBearerToken("Bearer abc.def-ghi_123")).toBe("abc.def-ghi_123");
  });
  it("accepts a case-insensitive scheme and trims outer spaces", () => {
    expect(extractBearerToken("  bearer tok.en  ")).toBe("tok.en");
  });
  it("rejects missing, wrong-scheme, empty and malformed values", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer a b")).toBeNull();
    expect(extractBearerToken("Bearer a;b")).toBeNull();
  });
});

describe("isValidSlug", () => {
  it("accepts normal slugs and rejects empty / over-long ones", () => {
    expect(isValidSlug("test-research-001")).toBe(true);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("a".repeat(201))).toBe(false);
  });
});

describe("getMobileReadUrl", () => {
  it("returns 404 when the item is not visible / not published", async () => {
    const { client } = makeClient({ item: null });
    const result = await getMobileReadUrl(client, "user-1", "nope");
    expect(result).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(readUrlMock).not.toHaveBeenCalled();
  });

  it("only looks up published items by slug", async () => {
    const { client, itemChain } = makeClient({ item: publicItem });
    readUrlMock.mockResolvedValue({ url: "https://signed.example/x", error: null });
    await getMobileReadUrl(client, "user-1", "my-slug");
    expect(itemChain.eq).toHaveBeenCalledWith("slug", "my-slug");
    expect(itemChain.eq).toHaveBeenCalledWith("status", "published");
  });

  it("returns 502 when the research lookup itself fails", async () => {
    const { client } = makeClient({ itemError: { message: "boom" } });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: false, status: 502, code: "unavailable" });
  });

  it("returns 404 when the item has no PDF file", async () => {
    const { client } = makeClient({ item: { ...publicItem, pdf_file: null } });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(readUrlMock).not.toHaveBeenCalled();
  });

  it("gives a signed url for a readable item and passes the right arguments", async () => {
    const { client } = makeClient({ item: publicItem });
    readUrlMock.mockResolvedValue({ url: "https://signed.example/x", error: null });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: true, url: "https://signed.example/x" });
    expect(readUrlMock).toHaveBeenCalledWith("owner-1/paper.pdf", "public", false, "clean");
  });

  it("blocks metadata_only items without a read grant (never asks for a url)", async () => {
    const { client } = makeClient({ item: { ...publicItem, access_level: "metadata_only" } });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: false, status: 403, code: "read_not_allowed" });
    expect(readUrlMock).not.toHaveBeenCalled();
  });

  it("allows metadata_only items when the user has an active read grant", async () => {
    const { client, grantChain } = makeClient({
      item: { ...publicItem, access_level: "metadata_only" },
      grant: { id: "grant-1" },
    });
    readUrlMock.mockResolvedValue({ url: "https://signed.example/g", error: null });
    const result = await getMobileReadUrl(client, "user-9", "s");
    expect(result).toEqual({ ok: true, url: "https://signed.example/g" });
    expect(readUrlMock).toHaveBeenCalledWith("owner-1/paper.pdf", "metadata_only", true, "clean");
    // grant ต้องผูกกับผู้ใช้ที่ยืนยันตัวตนแล้ว + ชนิด "read" + ยังไม่ถูกเพิกถอน
    expect(grantChain.eq).toHaveBeenCalledWith("user_id", "user-9");
    expect(grantChain.eq).toHaveBeenCalledWith("access_type", "read");
    expect(grantChain.eq).toHaveBeenCalledWith("research_item_id", "item-uuid-1");
    expect(grantChain.is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("treats a failed grant lookup as no grant (fail closed)", async () => {
    const { client } = makeClient({
      item: { ...publicItem, access_level: "metadata_only" },
      grantError: { message: "rls" },
    });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: false, status: 403, code: "read_not_allowed" });
    expect(readUrlMock).not.toHaveBeenCalled();
  });

  it.each(["pending", "infected", "error"])(
    "reports scan_pending (409) when the %s scan blocks the url",
    async (scan) => {
      const { client } = makeClient({ item: { ...publicItem, scan_status: scan } });
      readUrlMock.mockResolvedValue({ url: null, error: "scan" });
      const result = await getMobileReadUrl(client, "user-1", "s");
      expect(result).toEqual({ ok: false, status: 409, code: "scan_pending" });
    }
  );

  it("reports unavailable (502) when url creation fails for another reason", async () => {
    const { client } = makeClient({ item: publicItem });
    readUrlMock.mockResolvedValue({ url: null, error: "storage down" });
    const result = await getMobileReadUrl(client, "user-1", "s");
    expect(result).toEqual({ ok: false, status: 502, code: "unavailable" });
  });
});

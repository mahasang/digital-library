import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests ของ publishWithoutScanAction (เผยแพร่โดยยืนยันเอง) — พิสูจน์ว่า
 * ด่านความปลอดภัยทำงานตามลำดับ: สิทธิ์ → เหตุผล → ตัดสินซ้ำฝั่งเซิร์ฟเวอร์ → audit log
 * ก่อนลงมือ → ยกเลิก job สแกน → ตั้ง skipped (เงื่อนไขกันแข่ง) → เผยแพร่
 * และไม่มีทางที่ infected / ยังไม่อนุมัติ / เหตุผลว่าง จะไปถึงขั้นแก้ข้อมูล
 */

const calls: string[] = [];
const auditRows: Array<Record<string, unknown>> = [];
const overridePatches: Array<Record<string, unknown>> = [];
const overrideFilters: Array<[string, unknown]> = [];

const state = {
  guard: { ok: true, userId: "admin-1" } as
    | { ok: true; userId: string }
    | { ok: false; result: { status: "error"; message: string } },
  item: {
    id: "item-1",
    status: "approved",
    scan_status: "error",
    scan_provider: "none",
    title_th: "งานวิจัยทดสอบ",
  } as Record<string, unknown> | null,
  decision: { allowed: true, scanStatus: "error" } as Record<string, unknown>,
  auditError: null as { message: string } | null,
  overrideRow: { id: "item-1" } as { id: string } | null,
  overrideError: null as { message: string } | null,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "th",
  getTranslations: async () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
  isServiceRoleConfigured: () => true,
}));
vi.mock("@/lib/supabase/roles", () => ({ getCurrentUserRoleRank: async () => 40 }));
vi.mock("@/lib/data/settings.server", () => ({
  getSettings: async () => ({ notificationsEmailEnabled: false }),
}));
vi.mock("@/lib/notifications/email.server", () => ({ sendNotificationEmail: vi.fn() }));
vi.mock("@/lib/publishing/publish-event.server", () => ({
  notifyResearchPublished: async () => {
    calls.push("notify");
  },
}));
vi.mock("@/lib/errors/safe-message.server", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/cache/public-home", () => ({ revalidatePublicResearch: vi.fn() }));
vi.mock("@/lib/data/admin-guard.server", () => ({
  requireMinRank: async () => state.guard,
}));
vi.mock("@/lib/submission/scan-override.server", () => ({
  getScanOverrideDecision: async () => state.decision,
}));
vi.mock("@/lib/jobs/queue.server", () => ({
  cancelActiveJobsForEntity: async (...args: unknown[]) => {
    calls.push(`cancel:${JSON.stringify(args)}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    from(table: string) {
      if (table === "audit_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            calls.push("audit");
            auditRows.push(row);
            return { error: state.auditError };
          },
        };
      }
      // research_items: โหลดรายการ (select) และเผยแพร่ผ่าน changeStatus (update)
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: state.item, error: null }) }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => {
                calls.push(`publish:${String(patch.status)}`);
                return { data: { title_th: "งานวิจัยทดสอบ", submitted_by: null }, error: null };
              },
            }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from() {
      const chain = {
        update: (patch: Record<string, unknown>) => {
          overridePatches.push(patch);
          return chain;
        },
        eq: (col: string, val: unknown) => {
          overrideFilters.push([col, val]);
          return chain;
        },
        in: (col: string, val: unknown) => {
          overrideFilters.push([col, val]);
          return chain;
        },
        select: () => chain,
        maybeSingle: async () => {
          calls.push("override");
          return { data: state.overrideRow, error: state.overrideError };
        },
      };
      return chain;
    },
  }),
}));

import { publishWithoutScanAction } from "@/app/[locale]/dashboard/approvals/[id]/actions";

const GOOD_REASON = "ตรวจไฟล์ด้วยตนเองแล้ว เปิดอ่านได้ปกติ";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  calls.length = 0;
  auditRows.length = 0;
  overridePatches.length = 0;
  overrideFilters.length = 0;
  state.guard = { ok: true, userId: "admin-1" };
  state.item = {
    id: "item-1",
    status: "approved",
    scan_status: "error",
    scan_provider: "none",
    title_th: "งานวิจัยทดสอบ",
  };
  state.decision = { allowed: true, scanStatus: "error" };
  state.auditError = null;
  state.overrideRow = { id: "item-1" };
  state.overrideError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("publishWithoutScanAction", () => {
  it("ผู้ที่ rank ไม่ถึงถูกปฏิเสธและไม่มีการแก้ข้อมูลใดๆ", async () => {
    state.guard = { ok: false, result: { status: "error", message: "requiresAdminRank" } };
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "requiresAdminRank" });
    expect(calls).toEqual([]);
  });

  it("ไม่มีเหตุผล/เหตุผลสั้น → ปฏิเสธก่อนแตะข้อมูล", async () => {
    const empty = await publishWithoutScanAction(idle, form({ researchId: "item-1", reason: "  " }));
    expect(empty).toEqual({ status: "error", message: "scanOverrideReasonRequired" });

    const short = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: "สั้น" })
    );
    expect(short.status).toBe("error");
    expect((short as { message: string }).message).toContain("scanOverrideReasonTooShort");
    expect(calls).toEqual([]);
  });

  it("ไม่มี researchId → ปฏิเสธ", async () => {
    const result = await publishWithoutScanAction(idle, form({ reason: GOOD_REASON }));
    expect(result).toEqual({ status: "error", message: "scanOverrideNotFound" });
    expect(calls).toEqual([]);
  });

  it("ไม่พบรายการ → ปฏิเสธ", async () => {
    state.item = null;
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "scanOverrideNotFound" });
    expect(calls).toEqual([]);
  });

  it("ไฟล์ infected → ปฏิเสธ ไม่มี audit/ไม่แก้สถานะสแกน/ไม่เผยแพร่", async () => {
    state.decision = { allowed: false, reason: "infected" };
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "scanOverrideInfected" });
    expect(calls).toEqual([]);
    expect(overridePatches).toEqual([]);
  });

  it("ยังไม่อนุมัติ → ปฏิเสธ", async () => {
    state.decision = { allowed: false, reason: "not_approved" };
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "scanOverrideNotApproved" });
    expect(calls).toEqual([]);
  });

  it("เพิ่งเข้าคิวสแกน → ปฏิเสธและบอกจำนวนนาทีที่ต้องรอ", async () => {
    state.decision = { allowed: false, reason: "too_early", waitMinutes: 17 };
    const result = (await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    )) as { status: string; message: string };
    expect(result.status).toBe("error");
    expect(result.message).toBe('scanOverrideTooEarly:{"minutes":17}');
    expect(calls).toEqual([]);
  });

  it("เส้นทางสำเร็จ: audit → ยกเลิก job สแกน → ตั้ง skipped → เผยแพร่ ตามลำดับนี้", async () => {
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: `  ${GOOD_REASON}  ` })
    );

    expect(result).toEqual({ status: "success", message: "scanOverrideSuccess" });
    expect(calls).toEqual([
      "audit",
      `cancel:${JSON.stringify(["research_items", "item-1", ["file_security_rescan"]])}`,
      "override",
      "publish:published",
      "notify",
    ]);

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      actor_id: "admin-1",
      action: "publish_without_scan",
      entity_type: "research_items",
      entity_id: "item-1",
      metadata: {
        reason: GOOD_REASON,
        previous_scan_status: "error",
        previous_scan_provider: "none",
      },
    });

    expect(overridePatches).toHaveLength(1);
    expect(overridePatches[0]).toMatchObject({
      scan_status: "skipped",
      scan_provider: "admin_override",
    });
    expect(String(overridePatches[0].scan_reason)).toContain(GOOD_REASON);
    // เงื่อนไขกันแข่ง: แก้เฉพาะแถวที่ยัง approved และผลสแกนยัง pending/error
    expect(overrideFilters).toEqual(
      expect.arrayContaining([
        ["id", "item-1"],
        ["status", "approved"],
        ["scan_status", ["pending", "error"]],
      ])
    );
  });

  it("บันทึก audit log ไม่ได้ → หยุดทันที ไม่ข้ามการสแกนแบบไม่มีร่องรอย", async () => {
    state.auditError = { message: "rls denied" };
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "scanOverrideFailed" });
    expect(calls).toEqual(["audit"]);
    expect(overridePatches).toEqual([]);
  });

  it("ตั้ง skipped ไม่สำเร็จ (สถานะเปลี่ยนไปแล้ว/แถวไม่ตรงเงื่อนไข) → ไม่เผยแพร่", async () => {
    state.overrideRow = null;
    const result = await publishWithoutScanAction(
      idle,
      form({ researchId: "item-1", reason: GOOD_REASON })
    );
    expect(result).toEqual({ status: "error", message: "scanOverrideFailed" });
    expect(calls).not.toContain("publish:published");
  });
});

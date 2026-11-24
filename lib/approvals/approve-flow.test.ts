import { describe, expect, it } from "vitest";
import {
  BULK_APPROVE_MAX,
  APPROVE_AND_PUBLISH_FROM_STATUSES,
  assembleBulkResults,
  canApproveAndPublish,
  classifyBulkItems,
  parseBulkApproveIds,
  runWithinBudget,
  summarizeBulkResults,
} from "@/lib/approvals/approve-flow";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("canApproveAndPublish", () => {
  it("อนุญาตเมื่อรออนุมัติ/ขอแก้ไข และสแกนผ่านหรือข้ามสแกน", () => {
    for (const status of ["pending_review", "revision_requested"]) {
      for (const scanStatus of ["clean", "skipped"]) {
        expect(canApproveAndPublish({ status, scanStatus })).toEqual({ allowed: true });
      }
    }
  });

  it("ผลสแกน pending/error/infected ห้ามใช้ปุ่มรวม (ไม่เลี่ยงด่านสแกน)", () => {
    for (const scanStatus of ["pending", "error", "infected", "", null, undefined]) {
      expect(canApproveAndPublish({ status: "pending_review", scanStatus })).toEqual({
        allowed: false,
        reason: "scan_not_ready",
      });
    }
  });

  it("สถานะอื่นที่ไม่ใช่รออนุมัติ/ขอแก้ไข ห้ามใช้ปุ่มรวม แม้สแกนผ่าน", () => {
    for (const status of ["draft", "approved", "published", "rejected", "archived", null, undefined, "x"]) {
      expect(canApproveAndPublish({ status, scanStatus: "clean" })).toEqual({
        allowed: false,
        reason: "not_reviewable",
      });
    }
  });

  it("ตรวจสถานะก่อนผลสแกน (งานที่เผยแพร่แล้วต้องไม่ขึ้นว่า 'รอสแกน')", () => {
    expect(canApproveAndPublish({ status: "published", scanStatus: "pending" })).toEqual({
      allowed: false,
      reason: "not_reviewable",
    });
  });

  it("ชุดสถานะต้นทางตรงกับที่ปุ่ม 'อนุมัติ' เดิมใช้", () => {
    expect([...APPROVE_AND_PUBLISH_FROM_STATUSES]).toEqual(["pending_review", "revision_requested"]);
  });
});

describe("parseBulkApproveIds", () => {
  it("รับ UUID ที่ถูกต้อง ตัดซ้ำ และแปลงเป็นตัวพิมพ์เล็ก", () => {
    const upper = uuid(1).toUpperCase();
    expect(parseBulkApproveIds([upper, uuid(1), uuid(2)])).toEqual({
      ok: true,
      ids: [uuid(1), uuid(2)],
    });
  });

  it("ว่าง → empty", () => {
    expect(parseBulkApproveIds([])).toEqual({ ok: false, code: "empty" });
  });

  it("มีค่าที่ไม่ใช่ UUID หรือไม่ใช่ข้อความสักตัว → invalid ทั้งคำขอ", () => {
    expect(parseBulkApproveIds([uuid(1), "not-a-uuid"])).toEqual({ ok: false, code: "invalid" });
    expect(parseBulkApproveIds([uuid(1), 42])).toEqual({ ok: false, code: "invalid" });
    expect(parseBulkApproveIds([uuid(1), new Blob(["x"])])).toEqual({ ok: false, code: "invalid" });
    expect(parseBulkApproveIds([""])).toEqual({ ok: false, code: "invalid" });
  });

  it("เกินจำนวนสูงสุด → too_many (ไม่ตัดเงียบๆ) แต่ id ซ้ำไม่นับ", () => {
    const max = Array.from({ length: BULK_APPROVE_MAX }, (_, i) => uuid(i + 1));
    expect(parseBulkApproveIds(max).ok).toBe(true);
    expect(parseBulkApproveIds([...max, uuid(999)])).toEqual({ ok: false, code: "too_many" });
    expect(parseBulkApproveIds([...max, ...max]).ok).toBe(true);
  });
});

describe("classifyBulkItems", () => {
  it("แยก ไม่พบ / ไม่ได้รอตรวจสอบ / อนุมัติได้", () => {
    const ids = [uuid(1), uuid(2), uuid(3), uuid(4)];
    const rows = [
      { id: uuid(1), status: "pending_review" },
      { id: uuid(2), status: "revision_requested" },
      { id: uuid(3), status: "published" },
    ];
    const { eligible, immediate } = classifyBulkItems(ids, rows);
    expect(eligible).toEqual([uuid(1)]);
    expect(immediate).toEqual([
      { id: uuid(2), code: "not_pending" },
      { id: uuid(3), code: "not_pending" },
      { id: uuid(4), code: "not_found" },
    ]);
  });

  it("ไม่สนตัวพิมพ์ใหญ่เล็กของ id", () => {
    const { eligible } = classifyBulkItems(
      [uuid(1)],
      [{ id: uuid(1).toUpperCase(), status: "pending_review" }]
    );
    expect(eligible).toEqual([uuid(1)]);
  });
});

describe("runWithinBudget", () => {
  it("ทำครบทุกรายการเมื่อยังอยู่ในงบเวลา", async () => {
    let clock = 0;
    const result = await runWithinBudget(
      ["a", "b", "c"],
      async (id) => {
        clock += 100;
        return id.toUpperCase();
      },
      { budgetMs: 1000, now: () => clock }
    );
    expect(result.processed).toEqual([
      { id: "a", outcome: "A" },
      { id: "b", outcome: "B" },
      { id: "c", outcome: "C" },
    ]);
    expect(result.skippedIds).toEqual([]);
  });

  it("เกินงบแล้วหยุดเริ่มรายการใหม่ และรายการที่เหลือเป็น skipped", async () => {
    let clock = 0;
    const result = await runWithinBudget(
      ["a", "b", "c", "d"],
      async () => {
        clock += 400;
        return true;
      },
      { budgetMs: 700, now: () => clock }
    );
    // a: 0→400 · b เริ่มที่ 400 (<700) → 800 · c เริ่มที่ 800 (>=700) ข้าม
    expect(result.processed.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.skippedIds).toEqual(["c", "d"]);
  });

  it("รายการแรกทำเสมอแม้งบเวลาเป็น 0", async () => {
    const result = await runWithinBudget(["a", "b"], async () => 1, {
      budgetMs: 0,
      now: () => 0,
    });
    expect(result.processed.map((p) => p.id)).toEqual(["a"]);
    expect(result.skippedIds).toEqual(["b"]);
  });

  it("ทำทีละรายการตามลำดับ (ไม่ขนาน)", async () => {
    const order: string[] = [];
    await runWithinBudget(
      ["a", "b", "c"],
      async (id) => {
        order.push(`start-${id}`);
        await Promise.resolve();
        order.push(`end-${id}`);
      },
      { budgetMs: 1000, now: () => 0 }
    );
    expect(order).toEqual(["start-a", "end-a", "start-b", "end-b", "start-c", "end-c"]);
  });
});

describe("assembleBulkResults / summarizeBulkResults", () => {
  it("รวมผลทุกกลุ่มตามลำดับที่ผู้ใช้เลือก และนับสรุปถูก", () => {
    const ids = [uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)];
    const results = assembleBulkResults(
      ids,
      [
        { id: uuid(2), code: "not_pending" },
        { id: uuid(5), code: "not_found" },
      ],
      [
        { id: uuid(1), code: "approved" },
        { id: uuid(3), code: "failed" },
      ],
      [uuid(4)]
    );
    expect(results).toEqual([
      { id: uuid(1), code: "approved" },
      { id: uuid(2), code: "not_pending" },
      { id: uuid(3), code: "failed" },
      { id: uuid(4), code: "time_budget" },
      { id: uuid(5), code: "not_found" },
    ]);
    expect(summarizeBulkResults(results)).toEqual({ approved: 1, total: 5 });
  });

  it("id ที่หลุดทุกกลุ่มถือว่า failed (ไม่ตกหล่นเงียบ)", () => {
    expect(assembleBulkResults([uuid(1)], [], [], [])).toEqual([{ id: uuid(1), code: "failed" }]);
  });
});

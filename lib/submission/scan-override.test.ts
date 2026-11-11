import { describe, expect, it } from "vitest";
import {
  SCAN_OVERRIDE_MIN_STUCK_MINUTES,
  SCAN_OVERRIDE_PROVIDER,
  SCAN_OVERRIDE_REASON_MAX_LENGTH,
  SCAN_OVERRIDE_REASON_MIN_LENGTH,
  buildOverrideScanReason,
  evaluateScanOverride,
  isAdminScanOverride,
  validateOverrideReason,
} from "@/lib/submission/scan-override";

const NOW = new Date("2026-11-11T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("evaluateScanOverride", () => {
  it("ไม่อนุญาตถ้างานยังไม่อนุมัติ (ทุกสถานะที่ไม่ใช่ approved)", () => {
    for (const status of [
      "draft",
      "pending_review",
      "revision_requested",
      "rejected",
      "published",
      "archived",
    ] as const) {
      expect(
        evaluateScanOverride({ status, scanStatus: "error", pendingSince: null, now: NOW })
      ).toEqual({ allowed: false, reason: "not_approved" });
    }
  });

  it("ไม่มีทางข้ามไฟล์ที่สแกนแล้วพบว่า infected", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "infected",
        pendingSince: null,
        now: NOW,
      })
    ).toEqual({ allowed: false, reason: "infected" });
  });

  it("ไม่จำเป็นเมื่อสแกนผ่านแล้วหรือถูกข้ามอยู่แล้ว", () => {
    for (const scanStatus of ["clean", "skipped"] as const) {
      expect(
        evaluateScanOverride({ status: "approved", scanStatus, pendingSince: null, now: NOW })
      ).toEqual({ allowed: false, reason: "scan_not_blocking" });
    }
  });

  it("ผลสแกน error ทำได้ทันที", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "error",
        pendingSince: minutesAgo(1),
        now: NOW,
      })
    ).toEqual({ allowed: true, scanStatus: "error" });
  });

  it("pending ที่เพิ่งเข้าคิวต้องรอ และบอกจำนวนนาทีที่เหลือ", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "pending",
        pendingSince: minutesAgo(5),
        now: NOW,
      })
    ).toEqual({ allowed: false, reason: "too_early", waitMinutes: 25 });
  });

  it("pending ที่ค้างครบ 30 นาทีพอดีทำได้", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "pending",
        pendingSince: minutesAgo(SCAN_OVERRIDE_MIN_STUCK_MINUTES),
        now: NOW,
      })
    ).toEqual({ allowed: true, scanStatus: "pending" });
  });

  it("pending ที่ค้างเกิน 30 นาทีทำได้", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "pending",
        pendingSince: minutesAgo(600),
        now: NOW,
      })
    ).toMatchObject({ allowed: true, scanStatus: "pending" });
  });

  it("pending ที่ไม่มี job รอสแกนอยู่เลย (ไม่มีใครจะสแกน) ทำได้ทันที", () => {
    expect(
      evaluateScanOverride({
        status: "approved",
        scanStatus: "pending",
        pendingSince: null,
        now: NOW,
      })
    ).toEqual({ allowed: true, scanStatus: "pending" });
  });

  it("เวลา job อยู่ในอนาคต (นาฬิกาเพี้ยน) ไม่ทำให้รอเกิน 30 นาที", () => {
    const decision = evaluateScanOverride({
      status: "approved",
      scanStatus: "pending",
      pendingSince: new Date(NOW.getTime() + 10 * 60_000),
      now: NOW,
    });
    expect(decision).toEqual({
      allowed: false,
      reason: "too_early",
      waitMinutes: SCAN_OVERRIDE_MIN_STUCK_MINUTES,
    });
  });
});

describe("validateOverrideReason", () => {
  it("ต้องมีเหตุผล", () => {
    for (const raw of [undefined, null, "", "   ", 42]) {
      expect(validateOverrideReason(raw)).toEqual({ ok: false, code: "required" });
    }
  });

  it("สั้นเกินไป", () => {
    expect(validateOverrideReason("สั้น")).toEqual({ ok: false, code: "too_short" });
    expect(validateOverrideReason("x".repeat(SCAN_OVERRIDE_REASON_MIN_LENGTH - 1))).toEqual({
      ok: false,
      code: "too_short",
    });
  });

  it("ยาวเกินไป", () => {
    expect(validateOverrideReason("x".repeat(SCAN_OVERRIDE_REASON_MAX_LENGTH + 1))).toEqual({
      ok: false,
      code: "too_long",
    });
  });

  it("ตัดช่องว่างหัวท้ายแล้วรับค่าที่ถูกต้อง", () => {
    const reason = "ตรวจไฟล์ด้วยตนเองแล้ว เปิดอ่านได้ปกติ";
    expect(validateOverrideReason(`  ${reason}  `)).toEqual({ ok: true, reason });
    expect(validateOverrideReason("x".repeat(SCAN_OVERRIDE_REASON_MIN_LENGTH))).toMatchObject({
      ok: true,
    });
    expect(validateOverrideReason("x".repeat(SCAN_OVERRIDE_REASON_MAX_LENGTH))).toMatchObject({
      ok: true,
    });
  });
});

describe("buildOverrideScanReason / isAdminScanOverride", () => {
  it("ข้อความ scan_reason มีเหตุผลที่ผู้ดูแลระบุ", () => {
    expect(buildOverrideScanReason("เปิดอ่านได้ปกติ")).toContain("เปิดอ่านได้ปกติ");
  });

  it("จำแนกแถวที่ถูกยืนยันเองได้เฉพาะ skipped + admin_override", () => {
    expect(
      isAdminScanOverride({ scan_status: "skipped", scan_provider: SCAN_OVERRIDE_PROVIDER })
    ).toBe(true);
    expect(
      isAdminScanOverride({ scan_status: "skipped", scan_provider: "legacy-pre-scan" })
    ).toBe(false);
    expect(
      isAdminScanOverride({ scan_status: "error", scan_provider: SCAN_OVERRIDE_PROVIDER })
    ).toBe(false);
    expect(isAdminScanOverride({ scan_status: null, scan_provider: null })).toBe(false);
  });
});

import type { ScanStatusRow } from "@/lib/supabase/types";
import type { DocumentStatus } from "@/types/research";

/**
 * ตรรกะตัดสินว่า "เผยแพร่โดยยืนยันเอง" (ข้ามการรอผลสแกนไฟล์) ทำได้หรือไม่
 *
 * ใช้ร่วมกันระหว่างหน้าอนุมัติ (ตัดสินว่าจะโชว์ปุ่มหรือไม่) กับ server action
 * (ตัดสินซ้ำอีกครั้งฝั่งเซิร์ฟเวอร์ — ห้ามเชื่อค่าจาก client) จึงเป็นฟังก์ชันล้วน
 * ไม่ผูกกับ Supabase เพื่อทดสอบได้ตรงๆ
 *
 * หลักการ:
 * - ทำได้เฉพาะงานที่ "อนุมัติแล้ว" (ต้องผ่านผู้ตรวจก่อนเสมอ)
 * - ไม่เคยข้ามไฟล์ที่สแกนแล้วพบว่า "infected"
 * - สถานะ pending ต้องค้างเกิน SCAN_OVERRIDE_MIN_STUCK_MINUTES นาที (หรือไม่มี job
 *   ที่รอสแกนอยู่เลย) ส่วนสถานะ error ทำได้ทันที
 * - ไม่แตะ trigger/RLS ของฐานข้อมูล: ผลลัพธ์คือตั้ง scan_status = 'skipped'
 *   ซึ่ง trigger prevent_publish_unscanned_file ยอมให้ผ่านอยู่แล้ว
 */

export const SCAN_OVERRIDE_MIN_RANK = 40; // admin ขึ้นไป (admin, super_admin)
export const SCAN_OVERRIDE_MIN_STUCK_MINUTES = 30;
export const SCAN_OVERRIDE_PROVIDER = "admin_override";
export const SCAN_OVERRIDE_REASON_MIN_LENGTH = 10;
export const SCAN_OVERRIDE_REASON_MAX_LENGTH = 500;

export type ScanOverrideBlockReason =
  | "not_approved"
  | "scan_not_blocking"
  | "infected"
  | "too_early"
  | "unavailable";

export type ScanOverrideDecision =
  | { allowed: true; scanStatus: "pending" | "error" }
  | { allowed: false; reason: ScanOverrideBlockReason; waitMinutes?: number };

export function evaluateScanOverride(input: {
  status: DocumentStatus;
  scanStatus: ScanStatusRow;
  /** เวลาที่ job สแกนที่ยัง active ถูกสร้าง — null = ไม่มี job รอสแกนอยู่ */
  pendingSince: Date | null;
  now: Date;
}): ScanOverrideDecision {
  if (input.status !== "approved") {
    return { allowed: false, reason: "not_approved" };
  }
  if (input.scanStatus === "infected") {
    return { allowed: false, reason: "infected" };
  }
  if (input.scanStatus === "clean" || input.scanStatus === "skipped") {
    return { allowed: false, reason: "scan_not_blocking" };
  }
  if (input.scanStatus === "error") {
    return { allowed: true, scanStatus: "error" };
  }

  // pending
  if (!input.pendingSince) {
    return { allowed: true, scanStatus: "pending" };
  }
  const ageMinutes = Math.floor((input.now.getTime() - input.pendingSince.getTime()) / 60_000);
  if (ageMinutes < SCAN_OVERRIDE_MIN_STUCK_MINUTES) {
    return {
      allowed: false,
      reason: "too_early",
      waitMinutes: SCAN_OVERRIDE_MIN_STUCK_MINUTES - Math.max(ageMinutes, 0),
    };
  }
  return { allowed: true, scanStatus: "pending" };
}

export type OverrideReasonResult =
  | { ok: true; reason: string }
  | { ok: false; code: "required" | "too_short" | "too_long" };

export function validateOverrideReason(raw: unknown): OverrideReasonResult {
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (!reason) return { ok: false, code: "required" };
  if (reason.length < SCAN_OVERRIDE_REASON_MIN_LENGTH) return { ok: false, code: "too_short" };
  if (reason.length > SCAN_OVERRIDE_REASON_MAX_LENGTH) return { ok: false, code: "too_long" };
  return { ok: true, reason };
}

/**
 * สิ่งที่ฟอร์ม "ยืนยันเผยแพร่" ยังขาดอยู่ — ใช้เปิดปุ่มและแสดงข้อความใต้ปุ่มที่กดไม่ได้
 * (ใช้เกณฑ์ความยาวเดียวกับ validateOverrideReason: ตัดช่องว่างหัวท้ายก่อนนับ)
 * ฝั่งเซิร์ฟเวอร์ยังตรวจซ้ำเสมอ ฟังก์ชันนี้มีไว้ช่วยผู้ใช้เท่านั้น
 */
export function getOverrideFormMissing(input: { reason: string; confirmed: boolean }): {
  /** จำนวนตัวอักษรที่ยังต้องพิมพ์เพิ่ม (0 = พอแล้ว) */
  reasonShortBy: number;
  /** ยังไม่ได้ติ๊กช่องยืนยัน */
  needsConfirm: boolean;
} {
  return {
    reasonShortBy: Math.max(0, SCAN_OVERRIDE_REASON_MIN_LENGTH - input.reason.trim().length),
    needsConfirm: !input.confirmed,
  };
}

/** ข้อความที่เก็บใน research_items.scan_reason (แสดงในหน้า "การตรวจสอบไฟล์") */
export function buildOverrideScanReason(reason: string): string {
  return `ผู้ดูแลระบบยืนยันเอง (ข้ามการสแกน): ${reason}`;
}

/**
 * แถวนี้ถูก "ยืนยันเอง" ไว้หรือไม่ — ใช้ใน handler สแกนซ้ำเพื่อไม่ให้ผล error
 * จาก "ไม่มีระบบสแกน/ระบบสแกนขัดข้อง" ทับการยืนยันจนระบบปิดการเข้าถึงเอกสาร
 * ที่เผยแพร่ไปแล้วเอง (ผล infected จริงยังทับได้เสมอ)
 */
export function isAdminScanOverride(row: {
  scan_status: string | null;
  scan_provider: string | null;
}): boolean {
  return row.scan_status === "skipped" && row.scan_provider === SCAN_OVERRIDE_PROVIDER;
}

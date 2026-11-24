import { describe, expect, it } from "vitest";
import {
  SCANNER_NOT_CONFIGURED_PROVIDER,
  decideSyncScanHandling,
} from "@/lib/security/scan-decision";

type Status = "clean" | "infected" | "error" | "skipped";
const outcome = (status: Status, provider = "clamav:clamd:3310") => ({ status, provider });

describe("decideSyncScanHandling", () => {
  it("พบมัลแวร์ → ปฏิเสธเสมอ ไม่ว่าจะบังคับสแกนหรือไม่ และไม่ว่า provider ใด", () => {
    for (const required of [true, false]) {
      for (const provider of ["clamav:clamd:3310", "http:scan.example.com", "mock-dev", SCANNER_NOT_CONFIGURED_PROVIDER]) {
        expect(decideSyncScanHandling(outcome("infected", provider), required)).toBe(
          "reject_infected"
        );
      }
    }
  });

  it("ตั้งค่าระบบสแกนแล้วแต่ขัดข้อง + บังคับสแกน → ปฏิเสธ (fail closed)", () => {
    for (const provider of ["clamav:clamd:3310", "clamav", "http:scan.example.com", "http"]) {
      expect(decideSyncScanHandling(outcome("error", provider), true)).toBe("reject_unavailable");
    }
  });

  it("ยังไม่ได้ตั้งค่าระบบสแกนเลย (provider none) + บังคับสแกน → รับโดยไม่สแกน (ต้องบันทึก audit)", () => {
    expect(
      decideSyncScanHandling(outcome("error", SCANNER_NOT_CONFIGURED_PROVIDER), true)
    ).toBe("accept_unscanned");
  });

  it("ข้อยกเว้นใช้เฉพาะ provider \"none\" ตรงตัว ชื่อที่คล้ายกันยังถือว่าตั้งค่าแล้ว → ปฏิเสธ", () => {
    for (const provider of ["none:custom", "None", "no", ""]) {
      expect(decideSyncScanHandling(outcome("error", provider), true)).toBe("reject_unavailable");
    }
  });

  it("ไม่บังคับสแกน (เช่น dev) → error รับตามเดิม", () => {
    expect(decideSyncScanHandling(outcome("error", "clamav:clamd:3310"), false)).toBe("accept");
    expect(
      decideSyncScanHandling(outcome("error", SCANNER_NOT_CONFIGURED_PROVIDER), false)
    ).toBe("accept");
  });

  it("clean และ skipped รับตามปกติ", () => {
    for (const required of [true, false]) {
      expect(decideSyncScanHandling(outcome("clean"), required)).toBe("accept");
      expect(decideSyncScanHandling(outcome("skipped", "mock-dev"), required)).toBe("accept");
    }
  });
});

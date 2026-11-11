import { describe, expect, it } from "vitest";
import { createSubmissionSchema } from "@/lib/validation/submission";

/**
 * ฟอร์มส่งงานวิจัยตรวจ 3 ช่อง (หน่วยงาน/หมวดหมู่/ปี) ฝั่งเบราว์เซอร์ด้วย
 * `createSubmissionSchema(...).pick(...)` ตัวเดียวกับที่ server action ใช้ — เทสต์นี้
 * ยืนยันว่า key ที่ schema คืนตรงกับ key ที่ฟอร์มนำไปแสดงใต้ช่อง
 * (organizationId / categoryId / year) และข้อความมาจาก validation.submission.*
 */

const t = ((key: string) => key) as unknown as Parameters<typeof createSubmissionSchema>[0];
const basics = createSubmissionSchema(t).pick({
  organizationId: true,
  categoryId: true,
  year: true,
});

describe("submission basics (organization / category / year)", () => {
  it("accepts a normal selection and a Gregorian (CE) year", () => {
    expect(basics.safeParse({ organizationId: "org-1", categoryId: "science", year: 2026 }).success).toBe(true);
  });

  it("reports an empty organization and category under their own keys", () => {
    const result = basics.safeParse({ organizationId: "", categoryId: "", year: 2026 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.organizationId).toEqual(["submission.organizationRequired"]);
      expect(errors.categoryId).toEqual(["submission.categoryRequired"]);
      expect(errors.year).toBeUndefined();
    }
  });

  // 2569 = ปีปัจจุบันแบบ พ.ศ. — ต้องถูกปฏิเสธ เพราะระบบเก็บปีเป็น ค.ศ. แล้ว
  it.each([0, 999, 2101, 2569, 3000])("rejects the out-of-range year %i", (year) => {
    const result = basics.safeParse({ organizationId: "org-1", categoryId: "science", year });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.year).toEqual(["submission.yearOutOfRange"]);
    }
  });

  it.each([1000, 2100])("accepts the boundary year %i", (year) => {
    expect(basics.safeParse({ organizationId: "org-1", categoryId: "science", year }).success).toBe(true);
  });

  it("rejects a non-integer year", () => {
    const result = basics.safeParse({ organizationId: "org-1", categoryId: "science", year: 2026.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.year).toEqual(["submission.yearInvalid"]);
    }
  });

  it("passes the allowed range to the out-of-range message", () => {
    const calls: Array<[string, unknown]> = [];
    const recordingT = ((key: string, values?: unknown) => {
      calls.push([key, values]);
      return key;
    }) as unknown as Parameters<typeof createSubmissionSchema>[0];
    createSubmissionSchema(recordingT);
    expect(calls).toContainEqual(["submission.yearOutOfRange", { min: 1000, max: 2100 }]);
  });
});

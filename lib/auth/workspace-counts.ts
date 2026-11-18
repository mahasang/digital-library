/**
 * ตัวเลขงานค้างที่แสดงเป็น badge ในเมนูผู้ใช้ — logic ล้วน (ไม่แตะฐานข้อมูล)
 * แยกเป็น plain .ts เพื่อ unit-test ได้ เหมือน lib/auth/workspace-links.ts
 *
 * - pendingReview     : งานวิจัยที่รอตรวจทั้งระบบ (status = pending_review)
 *                       แสดงที่ลิงก์ "แดชบอร์ด" — เฉพาะบรรณารักษ์ขึ้นไป (rank >= 30)
 * - revisionRequested : งานของฉันที่ถูกขอให้แก้ไข (status = revision_requested
 *                       และ submitted_by = ฉัน) แสดงที่ลิงก์ "งานของฉัน"
 *                       — เฉพาะเจ้าหน้าที่ขึ้นไป (rank >= 20)
 *
 * ไม่มีผลต่อสิทธิ์: ลิงก์ที่แสดงยังมาจาก buildWorkspaceLinks() เหมือนเดิม และ
 * การนับทำฝั่งเซิร์ฟเวอร์ด้วย Supabase client ของผู้ใช้เอง (ผ่าน RLS)
 */
export interface WorkspaceCounts {
  pendingReview: number;
  revisionRequested: number;
}

export const EMPTY_WORKSPACE_COUNTS: WorkspaceCounts = {
  pendingReview: 0,
  revisionRequested: 0,
};

export const MIN_RANK_FOR_REVISION_COUNT = 20;
export const MIN_RANK_FOR_PENDING_REVIEW_COUNT = 30;

/** จำนวนที่ต้องแสดงที่ลิงก์นี้ (0 = ไม่แสดง badge) */
export function badgeCountForHref(href: string, counts: WorkspaceCounts): number {
  if (href === "/dashboard") return counts.pendingReview;
  if (href === "/my-submissions") return counts.revisionRequested;
  return 0;
}

/** ผลรวมบนปุ่มเมนูผู้ใช้ */
export function totalBadgeCount(links: ReadonlyArray<{ badgeCount?: number }>): number {
  return links.reduce((sum, link) => sum + (link.badgeCount ?? 0), 0);
}

/** ตัวเลขที่แสดงบนจอ — เกิน 99 แสดง "99+" ไม่ให้ badge ล้นกรอบ */
export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

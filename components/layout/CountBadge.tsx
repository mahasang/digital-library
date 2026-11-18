import { formatBadgeCount } from "@/lib/auth/workspace-counts";

/**
 * ป้ายตัวเลขงานค้างในเมนู (ใช้ได้ทั้ง Server และ Client Component — ไม่มี state)
 *
 * ตัวเลขบนจอซ่อนจากโปรแกรมอ่านหน้าจอ (aria-hidden) แล้วใช้ข้อความเต็ม
 * ("7 รายการที่ต้องดำเนินการ") ใน sr-only แทน เพื่อให้ลิงก์ถูกอ่านเป็น
 * "แดชบอร์ด, 7 รายการที่ต้องดำเนินการ" ไม่ใช่ "แดชบอร์ด 7" ที่ไม่รู้ว่า 7 อะไร
 *
 * สี bg-red-700 + ตัวอักษรขาว ให้ contrast ราว 6.5:1 (เกณฑ์ WCAG AA คือ 4.5:1)
 * count <= 0 ไม่ render อะไรเลย
 */
export default function CountBadge({
  count,
  label,
  className = "",
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        data-testid="count-badge"
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1.5 text-[11px] font-bold leading-none text-white ${className}`}
      >
        {formatBadgeCount(count)}
      </span>
      <span className="sr-only">, {label}</span>
    </>
  );
}

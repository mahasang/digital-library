import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/**
 * สถานะว่าง/ไม่พร้อมใช้งาน ที่ใช้ร่วมกันทั้งเว็บ (Hallmark Audit Phase 4) —
 * รวมรูปแบบที่เคยเขียนซ้ำแยกกันหลายจุด (`EmptyNotice`/`UnavailableNotice` ใน
 * app/superadmin/overview, กล่องเส้นประใน reports/audit-logs, ข้อความเปล่าๆ
 * ใน DLQ/cron lists) ให้เป็น component เดียว — ค่าเริ่มต้นตรงกับรูปแบบเดิมของ
 * AccountEmptyState (Phase 3) ทุกประการ
 *
 * tone="empty"       ดึงข้อมูลสำเร็จแต่ไม่มีรายการ (เช่น ไม่พบผลลัพธ์ตามตัวกรอง)
 * tone="unavailable"  ดึงข้อมูลไม่สำเร็จ/ฟีเจอร์นี้เข้าถึงไม่ได้จากแอปจริงๆ
 * compact             สำหรับพื้นที่แคบ (แถวในรายการ/ตาราง) — ไม่มีไอคอนวงกลมใหญ่
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  tone = "empty",
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "empty" | "unavailable";
  compact?: boolean;
}) {
  const boxTone =
    tone === "unavailable"
      ? "border-dashed border-gray-300 bg-gray-50"
      : "border-dashed border-gray-300 bg-surface";

  if (compact) {
    return (
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-3 text-sm text-gray-500 ${boxTone}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <span>{title}</span>
          {description && <span className="text-xs text-gray-500">{description}</span>}
          {action}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-center ${boxTone}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-6 w-6 text-gray-500" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

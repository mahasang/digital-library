import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * tone="action" ใช้กับตัวเลขที่ต้องการให้ผู้ดูแลระบบสังเกตเห็นว่าอาจต้อง
 * ดำเนินการ (เช่น "รอตรวจสอบ") — เปลี่ยนเฉพาะสีกล่องไอคอนเป็นเหลือง/amber
 * แทนที่จะเป็นสีน้ำเงินปกติ ไม่ใช้สีแดง/สัญญาณอันตรายเพราะไม่ใช่ข้อผิดพลาด
 * href (ถ้ามี) ทำให้การ์ดทั้งใบกดได้และโฟกัสด้วยคีย์บอร์ดได้ — ทั้งสอง prop
 * เป็น optional ไม่กระทบการใช้งานเดิมที่ไม่ส่งมา
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "default" | "action";
  href?: string;
}) {
  const iconBoxClass =
    tone === "action" ? "bg-amber-50 text-amber-600" : "bg-accent-soft text-accent-ink";

  const content = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBoxClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900">
          {typeof value === "number" ? value.toLocaleString("th-TH") : value}
        </p>
        <p className="truncate text-xs text-gray-500">{label}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-accent-soft"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-4">
      {content}
    </div>
  );
}

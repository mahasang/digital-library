import type { LucideIcon } from "lucide-react";

/**
 * การ์ดพื้นฐานที่ใช้ทั่วทั้งหน้า Dashboard/Super Admin (Hallmark Audit Phase
 * 4) — สรุปรูปแบบ `rounded-xl border border-gray-200 bg-surface p-5` ที่มีอยู่
 * แล้วในทุกหน้า (เขียนซ้ำแบบ inline มากกว่า 70 จุด) ให้เป็น component เดียว
 * แทนที่ Panel() ที่เคยประกาศแยกในแต่ละไฟล์ — ไม่เปลี่ยนรูปลักษณ์เดิม
 */
export default function Panel({
  icon: Icon,
  title,
  action,
  tone = "default",
  children,
}: {
  icon?: LucideIcon;
  title?: string;
  action?: React.ReactNode;
  /** "alert" ใช้เมื่อการ์ดนี้อยู่ในกลุ่ม "ต้องดำเนินการ" — ขอบซ้ายเน้นสีเดียว
   * ไม่ทำให้ทั้งการ์ดกลายเป็นสีฉูดฉาด */
  tone?: "default" | "alert";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border bg-surface p-5 ${
        tone === "alert" ? "border-gray-200 border-l-4 border-l-amber-400" : "border-gray-200"
      }`}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              {Icon && <Icon className="h-4 w-4 text-accent" aria-hidden="true" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

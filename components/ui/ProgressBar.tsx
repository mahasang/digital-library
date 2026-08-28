"use client";

interface ProgressBarProps {
  /** 0–100 — ไม่ใช้เมื่อ indeterminate=true */
  value: number;
  label?: string;
  className?: string;
  /** แสดงแถบเคลื่อนไหวไม่ทราบ % ที่แน่นอน — ใช้ตอนรอ response ที่ไม่มีทาง
   * รู้ความคืบหน้าจริง (เช่น รอ signed URL ก่อนดาวน์โหลด) */
  indeterminate?: boolean;
}

export function ProgressBar({ value, label, className, indeterminate = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {label && <p className="mb-1 text-sm text-gray-500">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        {indeterminate ? (
          <div className="h-2 w-full animate-pulse rounded-full bg-brand-600" />
        ) : (
          <div
            className="h-2 rounded-full bg-brand-600 transition-all duration-300 ease-out"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
      {!indeterminate && <p className="mt-1 text-right text-xs text-gray-500">{clamped}%</p>}
    </div>
  );
}

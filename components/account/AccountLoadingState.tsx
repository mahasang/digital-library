import { Loader2 } from "lucide-react";

/** สถานะกำลังโหลดที่ใช้ร่วมกันในหน้ากลุ่มบัญชี — แสดงระหว่างที่ Server
 * Component ของแต่ละหน้ากำลังดึงข้อมูล (Next.js loading.tsx convention) */
export default function AccountLoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        กำลังโหลดข้อมูล...
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    </div>
  );
}

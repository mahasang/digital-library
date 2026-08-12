import { DatabaseZap } from "lucide-react";

export default function SupabaseNotConfiguredNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <DatabaseZap className="h-8 w-8 text-amber-600" />
      <p className="text-sm font-semibold text-amber-800">
        ยังไม่ได้เชื่อมต่อ Supabase
      </p>
      <p className="text-xs leading-relaxed text-amber-700">
        กรุณาตั้งค่า <code className="rounded bg-amber-100 px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        และ <code className="rounded bg-amber-100 px-1 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        ในไฟล์ <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
        ก่อนใช้งานฟังก์ชันนี้ (ดูวิธีตั้งค่าได้ใน README.md)
      </p>
    </div>
  );
}

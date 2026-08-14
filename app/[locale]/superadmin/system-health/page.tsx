import type { Metadata } from "next";
import { Database, ShieldCheck, HardDrive, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { checkSystemHealth, type ServiceHealth } from "@/lib/data/system-health.server";

export const metadata: Metadata = { title: "System Health — Super Admin" };
export const dynamic = "force-dynamic";

const SERVICE_META = {
  database: { label: "Database (PostgreSQL)", icon: Database },
  auth: { label: "Supabase Auth", icon: ShieldCheck },
  storage: { label: "Supabase Storage", icon: HardDrive },
} as const;

export default async function SuperAdminSystemHealthPage() {
  const results = await checkSystemHealth();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">System Health</h1>
        <p className="mt-1 text-sm text-gray-500">
          ตรวจสอบสถานะการเชื่อมต่อ Database, Auth และ Storage แบบสดทุกครั้งที่โหลดหน้านี้
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {results.map((result) => (
          <ServiceCard key={result.service} result={result} />
        ))}
      </div>

      <p className="text-xs text-gray-500">
        การตรวจสอบนี้เป็นการเช็คแบบสด (real-time) ณ เวลาที่โหลดหน้า ไม่มีการเก็บ
        ประวัติสถานะย้อนหลังในระบบ — หากต้องการติดตามความพร้อมใช้งานระยะยาวแบบ
        อัตโนมัติ พร้อมประวัติย้อนหลังและการแจ้งเตือน{" "}
        <strong className="text-gray-500">ต้องเชื่อมต่อบริการ Uptime Monitoring ภายนอก</strong>{" "}
        (เช่น UptimeRobot, Better Uptime, Cloudflare Health Checks) เข้ากับ endpoint{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/api/health</code> — แอปนี้เองไม่มี
        ทางเก็บประวัติ/แจ้งเตือนอัตโนมัติได้ ดูขั้นตอนละเอียดใน{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">docs/uptime-monitoring.md</code>{" "}
        ในซอร์สโค้ดของโปรเจกต์
      </p>
    </div>
  );
}

function ServiceCard({ result }: { result: ServiceHealth }) {
  const meta = SERVICE_META[result.service];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
          <StatusBadge status={result.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {result.status === "unknown"
            ? "ยังไม่สามารถตรวจสอบอัตโนมัติได้ — กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local ก่อน"
            : result.detail}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          ตรวจสอบล่าสุด:{" "}
          {new Date(result.checkedAt).toLocaleString("th-TH", {
            dateStyle: "medium",
            timeStyle: "medium",
          })}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ServiceHealth["status"] }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        ใช้งานได้ปกติ
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        <XCircle className="h-3 w-3" />
        เชื่อมต่อไม่ได้
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      <HelpCircle className="h-3 w-3" />
      ยังไม่สามารถตรวจสอบได้
    </span>
  );
}

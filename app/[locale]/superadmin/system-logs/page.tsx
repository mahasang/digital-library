import type { Metadata } from "next";
import Link from "next/link";
import { FileWarning, ExternalLink, CheckCircle2 } from "lucide-react";
import { getLoggingProviderStatus } from "@/lib/logging/logger.server";

export const metadata: Metadata = { title: "System Logs — Super Admin" };
export const dynamic = "force-dynamic";

const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  sentry: "Sentry",
  betterstack: "Better Stack (Logtail)",
};

export default function SuperAdminSystemLogsPage() {
  const { configured, providerName } = getLoggingProviderStatus();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">System Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          บันทึกเหตุการณ์ระดับแอปพลิเคชัน (แยกจาก Audit Log ซึ่งบันทึกการกระทำของผู้ใช้)
        </p>
      </div>

      {configured ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                เชื่อมต่อ {providerName ? (PROVIDER_DISPLAY_NAME[providerName] ?? providerName) : "provider"} แล้ว
              </p>
              <p className="mt-1 text-sm text-green-700">
                Error ระดับแอปพลิเคชัน (ที่ผ่านการตัดข้อมูลอ่อนไหวออกแล้ว) จาก production
                จะถูกส่งไปยัง provider นี้โดยอัตโนมัติผ่าน Next.js instrumentation hook —
                ดูรายละเอียด/ค้นหาย้อนหลังได้ที่แดชบอร์ดของ provider โดยตรง แอปนี้ไม่มีสิทธิ์
                ดึงข้อมูล log กลับมาแสดงในหน้านี้ (provider ไม่เปิด API แบบนั้นให้)
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                ยังไม่ได้เชื่อมต่อระบบ Log รวมศูนย์
              </p>
              <p className="mt-1 text-sm text-amber-700">
                ยังไม่ได้ตั้งค่า <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">LOG_PROVIDER</code>{" "}
                จึงไม่มีข้อมูลจริงให้แสดงในหน้านี้ — เพื่อไม่ให้แสดงข้อมูลปลอมหรือ
                ทำให้เข้าใจผิดว่าระบบตรวจสอบอัตโนมัติอยู่ หน้านี้จึงแสดงเฉพาะ
                คำแนะนำการเชื่อมต่อแทน (ระบบยังทำงานได้ปกติ — error จะถูก log
                ผ่าน console/Vercel Runtime Logs เหมือนเดิม)
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          ปัจจุบัน log อยู่ที่ไหนบ้าง
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-gray-600">
          <li>
            <strong className="text-gray-800">ระหว่างพัฒนา (local):</strong> log ของ
            server ฝั่ง Next.js (รวมถึง <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">console.error</code>{" "}
            ที่เรียกใช้ทั่วทั้งแอปเมื่อเกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์) แสดงในเทอร์มินัลที่รัน{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">npm run dev</code>
          </li>
          <li>
            <strong className="text-gray-800">บน Vercel (production):</strong> log
            เดียวกันนี้ไปอยู่ที่ Vercel Dashboard &gt; โปรเจกต์ &gt; Logs
            (Runtime Logs ของ Serverless Functions) เก็บย้อนหลังตามแผนราคาของ Vercel
          </li>
          <li>
            <strong className="text-gray-800">ประวัติการกระทำของผู้ใช้:</strong> ดูที่{" "}
            <Link href="/superadmin/audit-logs" className="text-accent hover:underline">
              /superadmin/audit-logs
            </Link>{" "}
            แทน (เป็นข้อมูลจริงที่มีอยู่แล้วในฐานข้อมูล)
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          วิธีเชื่อมต่อระบบ Log รวมศูนย์ (มีในตัวแล้ว รองรับ 2 provider)
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          แอปนี้มี abstraction เชื่อมต่อ logging provider ในตัวแล้ว
          (<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">lib/logging/</code>) ส่ง error ระดับ
          แอปพลิเคชันที่ผ่านการตัดข้อมูลอ่อนไหว (token/secret/connection string) ออกแล้วโดยอัตโนมัติ —
          เลือก provider ผ่าน environment variable <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">LOG_PROVIDER</code>{" "}
          (ดูตัวแปรที่เกี่ยวข้องใน <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.env.example</code>) —
          ผู้ดูแลระบบต้องสมัครบริการเหล่านี้เอง (มีทั้ง free tier และแผนเสียเงินขึ้นกับปริมาณ log)
        </p>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="rounded-lg border border-gray-100 p-3">
            <p className="font-medium text-gray-800">Sentry — <code className="text-xs">LOG_PROVIDER=sentry</code></p>
            <p className="mt-1 text-xs text-gray-500">
              ตั้งค่า <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">SENTRY_DSN</code> จากโปรเจกต์
              Sentry ของคุณ (Settings &gt; Client Keys (DSN)) — ส่งผ่าน Envelope API โดยตรง ไม่ต้องติดตั้ง SDK เพิ่ม
            </p>
          </li>
          <li className="rounded-lg border border-gray-100 p-3">
            <p className="font-medium text-gray-800">Better Stack (Logtail) — <code className="text-xs">LOG_PROVIDER=betterstack</code></p>
            <p className="mt-1 text-xs text-gray-500">
              ตั้งค่า <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">LOGGING_BETTERSTACK_SOURCE_TOKEN</code>{" "}
              จาก Source ที่สร้างไว้ในบัญชี Better Stack ของคุณ
            </p>
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          ทางเลือกอื่น (ยังไม่มี built-in support ในแอปนี้ ต้องตั้งค่านอกแอปเอง): Vercel Log Drains
          (ต้องใช้แผน Pro ขึ้นไปของ Vercel — Settings &gt; Log Drains) หรือ Axiom (Vercel Marketplace Integration)
        </p>
        <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
          <ExternalLink className="h-3 w-3" />
          ลิงก์ทางการของแต่ละบริการควรค้นหาจากเว็บไซต์ผู้ให้บริการโดยตรงเสมอ
        </p>
      </section>
    </div>
  );
}

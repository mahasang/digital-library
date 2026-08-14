import type { Metadata } from "next";
import { DatabaseBackup, HelpCircle, BookOpen } from "lucide-react";
import { getBackupStatus } from "@/lib/data/superadmin-stats.server";

export const metadata: Metadata = { title: "Backups — Super Admin" };

export default function SuperAdminBackupsPage() {
  const status = getBackupStatus();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Backups</h1>
        <p className="mt-1 text-sm text-gray-500">
          สถานะการสำรองข้อมูลและแนวทางสำรอง/กู้คืนฐานข้อมูลและไฟล์
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
            <DatabaseBackup className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">สถานะ Backup ล่าสุด</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                <HelpCircle className="h-3 w-3" />
                ไม่พร้อมใช้งาน
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{status.reason}</p>
            <p className="mt-1 text-sm text-gray-600">{status.guidance}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              คู่มือสำรอง/กู้คืนข้อมูลฉบับเต็ม
            </p>
            <p className="mt-1 text-sm text-blue-700">
              ครอบคลุมวิธีสำรองฐานข้อมูล (Supabase Automatic Backups และ
              manual <code className="rounded bg-blue-100 px-1 py-0.5 text-xs">pg_dump</code>),
              วิธีสำรองไฟล์ใน Storage ทั้ง 4 bucket, ความถี่ที่แนะนำ, ขั้นตอนการกู้คืน
              และวิธีทดสอบแผนกู้คืน — ดูรายละเอียดทั้งหมดได้ที่ไฟล์{" "}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs">
                docs/backup-and-recovery.md
              </code>{" "}
              ในซอร์สโค้ดของโปรเจกต์
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">ทำไมถึงไม่มีปุ่ม &quot;สำรองข้อมูลตอนนี้&quot;</h2>
        <p className="text-sm text-gray-600">
          Supabase ไม่มี API สาธารณะให้แอปพลิเคชันภายนอกสั่งสำรองข้อมูล/อ่านสถานะ
          Backup ได้โดยตรง (การสำรองข้อมูลอัตโนมัติเป็นฟีเจอร์ที่ Supabase จัดการ
          ในระดับแพลตฟอร์ม ตรวจสอบและตั้งค่าได้เฉพาะผ่าน Supabase Dashboard เท่านั้น)
          หน้านี้จึงไม่มีปุ่มสั่งสำรองข้อมูลที่ใช้งานไม่ได้จริงให้กดโดยเจตนา —
          เพื่อไม่ให้ Super Admin เข้าใจผิดว่าระบบมีการสำรองข้อมูลเกิดขึ้นทั้งที่
          ไม่ได้เกิดขึ้นจริง
        </p>
      </section>
    </div>
  );
}

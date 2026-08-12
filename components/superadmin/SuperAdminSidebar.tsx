"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  Lock,
  HardDrive,
  Bell,
  ScrollText,
  FileWarning,
  Activity,
  DatabaseBackup,
  Menu,
  X,
  FolderTree,
  Building2,
  FileCog,
  ShieldAlert,
  Copy,
  ShieldQuestion,
  AlertOctagon,
  ScanText,
  ActivitySquare,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** จัดกลุ่มเมนู 14 รายการเป็น 5 กลุ่มเพื่อไม่ให้แถบเมนูยาวเกินไป */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/superadmin/overview", label: "ภาพรวมระบบ", icon: LayoutDashboard }],
  },
  {
    label: "ผู้ใช้และสิทธิ์",
    items: [
      { href: "/superadmin/users", label: "ผู้ใช้งาน", icon: Users },
      { href: "/superadmin/roles", label: "บทบาทและสิทธิ์", icon: ShieldCheck },
      { href: "/superadmin/mfa-status", label: "สถานะ MFA", icon: ShieldQuestion },
    ],
  },
  {
    label: "เนื้อหา",
    items: [
      { href: "/superadmin/categories", label: "จัดลำดับหมวดหมู่", icon: FolderTree },
      { href: "/superadmin/organizations", label: "จัดลำดับหน่วยงาน", icon: Building2 },
    ],
  },
  {
    label: "การตั้งค่า",
    items: [
      { href: "/superadmin/system-settings", label: "ตั้งค่าระบบขั้นสูง", icon: Settings },
      { href: "/superadmin/security", label: "ความปลอดภัย", icon: Lock },
      { href: "/superadmin/notifications", label: "การแจ้งเตือน", icon: Bell },
      { href: "/superadmin/ocr", label: "ตั้งค่า OCR", icon: ScanText },
    ],
  },
  {
    label: "งานพื้นหลัง",
    items: [
      { href: "/superadmin/pdf-processing", label: "ประมวลผล PDF", icon: FileCog },
      { href: "/superadmin/file-security", label: "ความปลอดภัยไฟล์", icon: ShieldAlert },
      { href: "/superadmin/data-quality", label: "คุณภาพข้อมูล", icon: Copy },
      { href: "/superadmin/jobs", label: "งานล้มเหลวถาวร (DLQ)", icon: AlertOctagon },
      { href: "/superadmin/cron-monitoring", label: "ตรวจสอบ Cron/Worker", icon: ActivitySquare },
    ],
  },
  {
    label: "ระบบและการตรวจสอบ",
    items: [
      { href: "/superadmin/storage", label: "Storage", icon: HardDrive },
      { href: "/superadmin/audit-logs", label: "Audit Log", icon: ScrollText },
      { href: "/superadmin/system-logs", label: "System Logs", icon: FileWarning },
      { href: "/superadmin/system-health", label: "System Health", icon: Activity },
      { href: "/superadmin/backups", label: "Backups", icon: DatabaseBackup },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const currentItem = ALL_ITEMS.find((item) => isActive(item.href));

  return (
    <>
      {/* มือถือ: ปุ่ม dropdown แสดงหน้าปัจจุบัน กดแล้วขยายเป็นรายการเมนูเต็ม
          (แทนแถบเลื่อนแนวนอนเดิมที่มี 11 รายการจนล้นจอ) */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800"
        >
          <span className="flex items-center gap-2">
            {currentItem ? (
              <currentItem.icon className="h-4 w-4" />
            ) : (
              <Crown className="h-4 w-4" />
            )}
            {currentItem?.label ?? "เมนู Super Admin"}
          </span>
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {mobileOpen && (
          <nav aria-label="เมนู Super Admin (มือถือ)" className="mt-2 flex flex-col gap-3 rounded-lg border border-gray-200 bg-surface p-3">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.label && (
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-amber-100 text-amber-800"
                          : "text-gray-600 hover:bg-amber-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-600"
            >
              ← กลับไป Admin Dashboard
            </Link>
          </nav>
        )}
      </div>

      {/* จอใหญ่: แถบข้าง จัดเป็นกลุ่มพร้อมหัวข้อกลุ่ม */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-800">
            <Crown className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Super Admin</span>
          </div>

          <nav aria-label="เมนู Super Admin" className="flex flex-col gap-4">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.label && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-amber-100 text-amber-800"
                          : "text-gray-600 hover:bg-amber-50 hover:text-amber-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-600"
          >
            ← กลับไป Admin Dashboard
          </Link>
        </div>
      </aside>
    </>
  );
}

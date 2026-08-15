"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
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
  labelKey: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

/** จัดกลุ่มเมนู 14 รายการเป็น 5 กลุ่มเพื่อไม่ให้แถบเมนูยาวเกินไป */
const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "",
    items: [{ href: "/superadmin/overview", labelKey: "nav.overview", icon: LayoutDashboard }],
  },
  {
    groupKey: "nav.groupUsers",
    items: [
      { href: "/superadmin/users", labelKey: "nav.users", icon: Users },
      { href: "/superadmin/roles", labelKey: "nav.roles", icon: ShieldCheck },
      { href: "/superadmin/mfa-status", labelKey: "nav.mfaStatus", icon: ShieldQuestion },
    ],
  },
  {
    groupKey: "nav.groupContent",
    items: [
      { href: "/superadmin/categories", labelKey: "nav.categories", icon: FolderTree },
      { href: "/superadmin/organizations", labelKey: "nav.organizations", icon: Building2 },
    ],
  },
  {
    groupKey: "nav.groupSettings",
    items: [
      { href: "/superadmin/system-settings", labelKey: "nav.systemSettings", icon: Settings },
      { href: "/superadmin/security", labelKey: "nav.security", icon: Lock },
      { href: "/superadmin/notifications", labelKey: "nav.notifications", icon: Bell },
      { href: "/superadmin/ocr", labelKey: "nav.ocr", icon: ScanText },
    ],
  },
  {
    groupKey: "nav.groupJobs",
    items: [
      { href: "/superadmin/pdf-processing", labelKey: "nav.pdfProcessing", icon: FileCog },
      { href: "/superadmin/file-security", labelKey: "nav.fileSecurity", icon: ShieldAlert },
      { href: "/superadmin/data-quality", labelKey: "nav.dataQuality", icon: Copy },
      { href: "/superadmin/jobs", labelKey: "nav.jobs", icon: AlertOctagon },
      {
        href: "/superadmin/cron-monitoring",
        labelKey: "nav.cronMonitoring",
        icon: ActivitySquare,
      },
    ],
  },
  {
    groupKey: "nav.groupSystem",
    items: [
      { href: "/superadmin/storage", labelKey: "nav.storage", icon: HardDrive },
      { href: "/superadmin/audit-logs", labelKey: "nav.auditLogs", icon: ScrollText },
      { href: "/superadmin/system-logs", labelKey: "nav.systemLogs", icon: FileWarning },
      { href: "/superadmin/system-health", labelKey: "nav.systemHealth", icon: Activity },
      { href: "/superadmin/backups", labelKey: "nav.backups", icon: DatabaseBackup },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function SuperAdminSidebar() {
  const t = useTranslations("superadmin");
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
            {currentItem ? t(currentItem.labelKey) : t("nav.mobileTitle")}
          </span>
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {mobileOpen && (
          <nav aria-label={t("nav.mobileLabel")} className="mt-2 flex flex-col gap-3 rounded-lg border border-gray-200 bg-surface p-3">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.groupKey && (
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {t(group.groupKey)}
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
                      {t(item.labelKey)}
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
              {t("nav.backToDashboard")}
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

          <nav aria-label={t("nav.desktopLabel")} className="flex flex-col gap-4">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.groupKey && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {t(group.groupKey)}
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
                      {t(item.labelKey)}
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
            {t("nav.backToDashboard")}
          </Link>
        </div>
      </aside>
    </>
  );
}

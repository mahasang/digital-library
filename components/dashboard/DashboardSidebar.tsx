"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  FileText,
  FileQuestion,
  FolderTree,
  Users,
  Building2,
  BarChart3,
  ScrollText,
  Settings,
  ClipboardCheck,
  Contact,
  ShieldCheck,
  Copy,
  MessageSquare,
} from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  minRank: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard, minRank: 30 },
  { href: "/dashboard/approvals", labelKey: "nav.approvals", icon: ClipboardCheck, minRank: 30 },
  {
    href: "/dashboard/access-requests",
    labelKey: "nav.accessRequests",
    icon: FileQuestion,
    minRank: 30,
  },
  { href: "/dashboard/research", labelKey: "nav.research", icon: FileText, minRank: 30 },
  {
    href: "/dashboard/duplicate-reviews",
    labelKey: "nav.duplicateReviews",
    icon: Copy,
    minRank: 30,
  },
  { href: "/dashboard/contact-messages", labelKey: "nav.contactMessages", icon: MessageSquare, minRank: 30 },
  { href: "/dashboard/authors", labelKey: "nav.authors", icon: Contact, minRank: 30 },
  { href: "/dashboard/organizations", labelKey: "nav.organizations", icon: Building2, minRank: 30 },
  { href: "/dashboard/data-quality", labelKey: "nav.dataQuality", icon: ShieldCheck, minRank: 30 },
  { href: "/dashboard/categories", labelKey: "nav.categories", icon: FolderTree, minRank: 30 },
  { href: "/dashboard/reports", labelKey: "nav.reports", icon: BarChart3, minRank: 30 },
  { href: "/dashboard/users", labelKey: "nav.users", icon: Users, minRank: 40 },
  { href: "/dashboard/audit-logs", labelKey: "nav.auditLog", icon: ScrollText, minRank: 40 },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings, minRank: 40 },
];

export default function DashboardSidebar({ rank }: { rank: number }) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => rank >= item.minRank);

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  return (
    <>
      {/* มือถือ: แถบเมนูเลื่อนแนวนอน */}
      <nav aria-label={t("mobileNavLabel")} className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 pb-2 lg:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-accent-soft text-accent-ink"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* จอใหญ่: แถบข้าง */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav aria-label={t("desktopNavLabel")} className="sticky top-20 flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-accent-soft text-accent-ink"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Clock, Heart, UserCircle, type LucideIcon } from "lucide-react";
import Container from "@/components/ui/Container";

interface AccountNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: AccountNavItem[] = [
  { href: "/favorites", label: "รายการโปรด", icon: Heart },
  { href: "/reading-history", label: "ประวัติการอ่าน", icon: Clock },
  { href: "/account", label: "โปรไฟล์ของฉัน", icon: UserCircle },
  { href: "/notifications", label: "การแจ้งเตือน", icon: Bell },
];

/**
 * เปลือกหน้าบัญชีที่ใช้ร่วมกันทั้ง 4 หน้า (Hallmark Audit Phase 3) —
 * รวม navigation ไว้จุดเดียวแทนการเขียนซ้ำในแต่ละหน้า แต่ละ route (URL)
 * ยังคงเดิมทุกประการ (/favorites, /reading-history, /account,
 * /notifications) — ไม่ใช้กลไก Next.js nested layout เพราะ 4 เส้นทางนี้
 * ไม่ได้อยู่ใต้ URL segment เดียวกัน การย้าย URL จะกระทบลิงก์เดิมทั้งหมด
 */
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="py-8 sm:py-10">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <nav aria-label="เมนูบัญชีของฉัน" className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
            {/* มือถือ/แท็บเล็ต: แถบแท็บเลื่อนแนวนอน */}
            <ul role="list" className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-gray-200 bg-surface text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* เดสก์ท็อป: side navigation แนวตั้ง */}
            <ul
              role="list"
              className="hidden flex-col gap-1 rounded-xl border border-gray-200 bg-surface p-2 lg:flex"
            >
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent-soft text-accent-ink"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </Container>
    </div>
  );
}

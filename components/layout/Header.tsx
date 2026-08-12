"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search, BookOpen } from "lucide-react";
import Container from "@/components/ui/Container";
import ThemeToggle from "@/components/layout/ThemeToggle";

const navLinks = [
  { href: "/", label: "หน้าแรก" },
  { href: "/research", label: "งานวิจัย" },
  { href: "/about", label: "เกี่ยวกับเรา" },
  { href: "/contact", label: "ติดต่อเรา" },
];

/**
 * Hallmark — header rendering refactor. Header เป็น "เปลือก" ของแถบเมนูบนสุด
 * ล้วนๆ ตอนนี้: โลโก้/ชื่อเว็บ, เมนูนำทางสาธารณะ (navLinks), ปุ่มสลับธีม, ปุ่ม
 * ค้นหา, และปุ่มเปิด/ปิดเมนูมือถือ — ไม่มีการดึงข้อมูลผู้ใช้/การแจ้งเตือน/สิทธิ์
 * ใดๆ ในไฟล์นี้เองอีกต่อไป (ย้ายไปที่ components/layout/HeaderAccountArea.tsx
 * ซึ่งเป็น Server Component แยกต่างหาก) ส่วนที่ขึ้นกับผู้ใช้ (เมนูผู้ใช้/กระดิ่ง
 * แจ้งเตือน/ลิงก์ตามสิทธิ์ หรือปุ่มเข้าสู่ระบบ/สมัครสมาชิกสำหรับ guest) รับเข้ามา
 * เป็น React node สำเร็จรูปผ่าน props `desktopAccountArea`/`mobileAccountArea`
 * (app/layout.tsx เป็นผู้ห่อแต่ละอันด้วย <Suspense> ก่อนส่งเข้ามา) — Header เอง
 * ไม่รู้และไม่สนใจว่าผู้ใช้เป็นใคร/มีสิทธิ์อะไร แค่วางตำแหน่งให้ถูกเท่านั้น
 *
 * ปิดเมนูมือถืออัตโนมัติเมื่อ pathname เปลี่ยน (นำทางสำเร็จ) แทนการผูก
 * onClick={() => setOpen(false)} ไว้กับลิงก์แต่ละอันแบบเดิม — จำเป็นเพราะลิงก์
 * ในส่วนบัญชีผู้ใช้ (workspaceLinks/โปรไฟล์/ออกจากระบบ/เข้าสู่ระบบ) อยู่ใน
 * mobileAccountArea ซึ่งเป็น Server Component ที่ไม่มีทางเรียก setOpen (state
 * ของ Client Component นี้) ได้โดยตรงเลย วิธีนี้ยังทำให้ลิงก์นำทางสาธารณะ
 * (navLinks) ปิดเมนูด้วยกลไกเดียวกัน สม่ำเสมอทั้งหมด
 */
export default function Header({
  desktopAccountArea,
  mobileAccountArea,
  siteName = "ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
  logoUrl = "",
}: {
  desktopAccountArea: ReactNode;
  mobileAccountArea: ReactNode;
  siteName?: string;
  logoUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-[var(--color-surface-translucent)] backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={siteName}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                <BookOpen className="h-5 w-5" />
              </span>
            )}
            <span className="hidden max-w-[220px] text-sm font-bold leading-tight text-gray-900 sm:line-clamp-2 sm:block">
              {siteName}
            </span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent-soft text-accent-ink"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link
              href="/research"
              aria-label="ค้นหางานวิจัย"
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              <Search className="h-5 w-5" />
            </Link>
            {desktopAccountArea}
          </div>

          <button
            type="button"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </Container>

      {open && (
        <div className="border-t border-gray-200 bg-surface md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            <div className="mb-1 flex items-center justify-between rounded-md px-3 py-1.5">
              <span className="text-xs font-medium text-gray-500">โหมดสี</span>
              <ThemeToggle />
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {link.label}
              </Link>
            ))}
            {mobileAccountArea}
          </Container>
        </div>
      )}
    </header>
  );
}

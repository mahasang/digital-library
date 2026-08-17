"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookOpen } from "lucide-react";
import Container from "@/components/ui/Container";
import type { AppSettings } from "@/types/research";

/**
 * Footer แบบย่อสำหรับหน้าอ่านเอกสาร (Hallmark Audit Phase 2) — ใช้แทน Footer
 * เต็มรูปแบบเฉพาะบนเส้นทาง /research/[id]/read เท่านั้น (ดู FooterSwitcher)
 * เพื่อไม่ให้ลิงก์การตลาด/ชวนสมัครสมาชิกรบกวนสมาธิระหว่างอ่าน แต่ยังคงข้อมูล
 * ที่จำเป็นไว้ครบ: ชื่อองค์กร ข้อความลิขสิทธิ์ และช่องทางติดต่อ/ข้อมูลองค์กร
 * (ผ่านลิงก์ไปหน้าเกี่ยวกับเรา/ติดต่อเรา แทนการแสดงรายละเอียดเต็ม)
 */
export default function ReaderFooter({ settings }: { settings: AppSettings }) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <Container className="flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-gray-900">{settings.siteName}</span>
        </div>

        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} {settings.siteName} {settings.copyrightText}
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <Link href="/about" className="hover:text-brand-700">
            {t("about")}
          </Link>
          <Link href="/contact" className="hover:text-brand-700">
            {t("contact")}
          </Link>
        </div>
      </Container>
    </footer>
  );
}

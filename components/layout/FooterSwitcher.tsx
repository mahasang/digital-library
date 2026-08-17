"use client";

import { usePathname } from "@/i18n/navigation";
import Footer from "@/components/layout/Footer";
import ReaderFooter from "@/components/layout/ReaderFooter";
import OperationalFooter from "@/components/layout/OperationalFooter";
import type { AppSettings, Category } from "@/types/research";

const READ_ROUTE_PATTERN = /^\/research\/[^/]+\/read\/?$/;
const OPERATIONAL_ROUTE_PATTERN = /^\/(dashboard|superadmin)(\/|$)/;

/**
 * เลือก Footer ตามเส้นทางปัจจุบัน (Hallmark Audit Phase 2 + Phase 4) — เป็น
 * จุดเดียวที่ app/layout.tsx เปลี่ยนแปลงสำหรับงานนี้ ทุกหน้าสาธารณะยังคงได้
 * Footer เต็มรูปแบบเดิมทุกประการ ไม่มีการเปลี่ยนแปลง layout อื่นใดนอกเหนือ
 * จากนี้:
 *   - /research/[id]/read      → ReaderFooter (Phase 2)
 *   - /dashboard, /superadmin  → OperationalFooter (Phase 4)
 *   - อื่นๆ ทั้งหมด             → Footer เต็มรูปแบบเดิม
 */
export default function FooterSwitcher({
  settings,
  categories,
}: {
  settings: AppSettings;
  categories: Category[];
}) {
  const pathname = usePathname();
  if (pathname && READ_ROUTE_PATTERN.test(pathname)) {
    return <ReaderFooter settings={settings} />;
  }
  if (pathname && OPERATIONAL_ROUTE_PATTERN.test(pathname)) {
    return <OperationalFooter settings={settings} />;
  }
  return <Footer settings={settings} categories={categories} />;
}

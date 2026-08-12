import Container from "@/components/ui/Container";
import type { AppSettings } from "@/types/research";

/**
 * Footer แบบย่อที่สุดสำหรับพื้นที่ปฏิบัติการ (Hallmark Audit Phase 4) — ใช้แทน
 * Footer เต็มรูปแบบบนทุกหน้าใต้ /dashboard และ /superadmin (ดู
 * FooterSwitcher) หน้าเหล่านี้เป็นเครื่องมือภายในสำหรับผู้ใช้ที่ล็อกอินแล้ว
 * เท่านั้น ลิงก์การตลาด/หมวดหมู่/สมัครสมาชิกจึงไม่มีประโยชน์และเป็นการ
 * รบกวนหน้าจอที่ใช้งานหนาแน่นอยู่แล้ว — คงไว้เฉพาะข้อความลิขสิทธิ์ซึ่งเป็น
 * ข้อมูลที่จำเป็นต้องแสดง
 */
export default function OperationalFooter({ settings }: { settings: AppSettings }) {
  return (
    <footer className="border-t border-gray-200">
      <Container className="py-4">
        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} {settings.siteName} {settings.copyrightText}
        </p>
      </Container>
    </footer>
  );
}

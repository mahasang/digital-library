import Link from "next/link";
import { FileSearch } from "lucide-react";
import Container from "@/components/ui/Container";

/**
 * i18n cleanup pass — LinkButton ใช้ next-intl Link ภายในแล้ว (ต้องมี
 * NextIntlClientProvider ในทรี) แต่ app/not-found.tsx อยู่นอก app/[locale]/
 * (ตามที่ตั้งใจไว้ตั้งแต่ Phase 0A — ต้องอยู่ที่ root เพราะเป็น fallback ของ
 * path ที่จับคู่ locale segment ไม่ได้เลย) จึงไม่มี locale context ให้ใช้เลย
 * ใช้ next/link ธรรมดา + คัดลอก class จาก LinkButton (variant=primary/outline,
 * size=md) มาตรงๆ แทนการใช้ LinkButton ที่จะ throw runtime error ในหน้านี้
 */
const buttonBaseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <Container className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <FileSearch className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-bold text-gray-900">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="mt-2 text-sm text-gray-500">
          หน้านี้อาจถูกย้าย ลบ หรือไม่มีอยู่ในระบบ กรุณาตรวจสอบลิงก์อีกครั้ง
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className={`${buttonBaseClasses} bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600`}
          >
            กลับหน้าแรก
          </Link>
          <Link
            href="/research"
            className={`${buttonBaseClasses} border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline-brand-600`}
          >
            ค้นหางานวิจัย
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          หรือดู{" "}
          <Link href="/research" className="underline">
            รายการงานวิจัยทั้งหมด
          </Link>
        </p>
      </Container>
    </div>
  );
}

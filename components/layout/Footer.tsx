import Link from "next/link";
import { BookOpen, Mail, MapPin, Phone } from "lucide-react";
import Container from "@/components/ui/Container";
import type { AppSettings, Category } from "@/types/research";

export default function Footer({
  settings,
  categories,
}: {
  settings: AppSettings;
  categories: Category[];
}) {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <Container className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-gray-900">{settings.siteName}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-500">
            แหล่งรวมงานวิจัย บทความวิชาการ และเอกสาร eBook ขององค์กร
            เพื่อการค้นคว้าและต่อยอดองค์ความรู้
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">หมวดหมู่งานวิจัย</h2>
          <ul className="mt-3 space-y-2">
            {categories.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/research?category=${c.id}`}
                  className="text-sm text-gray-500 hover:text-brand-700"
                >
                  {c.nameTh}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">เมนูลัด</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/research" className="text-sm text-gray-500 hover:text-brand-700">
                ค้นหางานวิจัย
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-sm text-gray-500 hover:text-brand-700">
                เกี่ยวกับเรา
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-sm text-gray-500 hover:text-brand-700">
                ติดต่อเรา
              </Link>
            </li>
            <li>
              <Link href="/register" className="text-sm text-gray-500 hover:text-brand-700">
                สมัครสมาชิก
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">ติดต่อเรา</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-gray-500">
            {settings.contactAddress && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{settings.contactAddress}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{settings.contactPhone}</span>
              </li>
            )}
            {settings.contactEmail && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{settings.contactEmail}</span>
              </li>
            )}
          </ul>
        </div>
      </Container>
      <div className="border-t border-gray-200 py-4">
        <Container>
          <p className="text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {settings.siteName} {settings.copyrightText}
          </p>
        </Container>
      </div>
    </footer>
  );
}

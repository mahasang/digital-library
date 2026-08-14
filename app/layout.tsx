import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
    template: "%s | ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
  },
  description:
    "แหล่งรวมงานวิจัยและเอกสาร eBook ขององค์กร ค้นหา อ่าน และดาวน์โหลดงานวิจัยตามสิทธิ์การเข้าถึง",
};

/**
 * i18n Phase 0A — root layout ตัวจริงตามข้อบังคับของ Next.js App Router
 * (<html>/<body> เรนเดอร์ได้ที่จุดเดียวในทั้งแอปเท่านั้น) คงไว้ที่นี่เพื่อรองรับ
 * route ที่อยู่นอก app/[locale]/ เช่น app/not-found.tsx และ app/api/* — UI จริง
 * ทั้งหมด (Header, Footer, ThemeProvider, IdleLogout, NextIntlClientProvider)
 * ย้ายไปอยู่ที่ app/[locale]/layout.tsx (nested layout) แล้วทั้งหมด
 *
 * lang ใช้ getLocale() จาก next-intl/server แทนการ hardcode "th" เพื่อให้ถูก
 * ต้องแม้ในหน้าภาษาอังกฤษ/ลาว — next-intl resolve locale จาก request ที่
 * middleware.ts กำหนดไว้แล้วเสมอสำหรับ route ปกติทุกเส้นทาง ส่วน route ที่หลุด
 * จาก [locale] จริงๆ (ไม่ผ่าน intl middleware เลย) จะได้ routing.defaultLocale
 * ("th") เป็นค่าเริ่มต้นอย่างปลอดภัยจาก i18n/request.ts
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={notoSansThai.variable} suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col font-sans antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import HeaderAccountArea, { HeaderAccountAreaSkeleton } from "@/components/layout/HeaderAccountArea";
import FooterData, { FooterSkeleton } from "@/components/layout/FooterData";
import IdleLogoutGate from "@/components/auth/IdleLogoutGate";
import ThemeProvider from "@/components/layout/ThemeProvider";
import { getPublicHomeSettings } from "@/lib/data/settings.server";

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
 * Hallmark — header rendering refactor (ต่อยอดจาก Hallmark — homepage
 * data-flow optimization และ public homepage caching) เดิม RootLayout เรียก
 * getSessionUser() + getSettings() + getCategories() + (ถ้ามี user)
 * getMyNotifications()/getUnreadNotificationCount() รวมเป็น Promise.all เดียว
 * ที่บล็อกทุก route ทั้งเว็บ — ต้องรอให้ครบทุกตัวก่อน React ถึงจะเริ่ม render
 * อะไรได้เลยแม้แต่ {children} เพราะไม่มี <Suspense> คั่นไว้เลย
 *
 * ตอนนี้ RootLayout เหลือ await เดียว (getPublicHomeSettings() — cache ไว้
 * แล้วผ่าน unstable_cache จาก Hallmark ก่อนหน้า จึงเบามาก ใช้แค่ siteName/
 * logoUrl สำหรับโลโก้ใน Header ซึ่งเป็นส่วนหนึ่งของ "เมนูนำทางสาธารณะ" ที่ควร
 * render ทันทีไม่ต้องมี skeleton กระพริบ) ส่วนที่เหลือทั้งหมด (บัญชีผู้ใช้ x2,
 * Footer, IdleLogout) ย้ายไปเป็น Server Component แยกที่ห่อด้วย <Suspense>
 * ของตัวเอง — {children} (เนื้อหาแต่ละหน้า) จึงเริ่ม stream ได้ทันทีโดยไม่ต้อง
 * รอข้อมูลบัญชีผู้ใช้ที่ช้ากว่าและเปลี่ยนไปตามแต่ละคนเลย
 *
 * การตรวจสอบสิทธิ์ (role) ทั้งหมดยังคงทำฝั่งเซิร์ฟเวอร์ผ่าน getSessionUser()
 * เหมือนเดิมทุกประการ (ดู components/layout/HeaderAccountArea.tsx,
 * components/auth/IdleLogoutGate.tsx) — middleware.ts ก็ยังตรวจสอบ/ป้องกัน
 * route ที่ต้องมีสิทธิ์เหมือนเดิมทุกประการ ไม่ถูกแตะต้องเลยในงานนี้ ไม่มีการส่ง
 * user/role จาก middleware ผ่าน request header ที่เชื่อถือได้แทนการตรวจสอบ
 * ฝั่งเซิร์ฟเวอร์แต่อย่างใด
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { siteName, logoUrl } = await getPublicHomeSettings();

  return (
    <html lang="th" className={notoSansThai.variable} suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col font-sans antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <a href="#main-content" className="skip-link">
            ข้ามไปยังเนื้อหาหลัก
          </a>
          <Header
            siteName={siteName}
            logoUrl={logoUrl}
            desktopAccountArea={
              <Suspense fallback={<HeaderAccountAreaSkeleton variant="desktop" />}>
                <HeaderAccountArea variant="desktop" />
              </Suspense>
            }
            mobileAccountArea={
              <Suspense fallback={<HeaderAccountAreaSkeleton variant="mobile" />}>
                <HeaderAccountArea variant="mobile" />
              </Suspense>
            }
          />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Suspense fallback={<FooterSkeleton />}>
            <FooterData />
          </Suspense>
          <Suspense fallback={null}>
            <IdleLogoutGate />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}

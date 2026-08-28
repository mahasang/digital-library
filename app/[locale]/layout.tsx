import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import Header from "@/components/layout/Header";
import HeaderAccountArea, { HeaderAccountAreaSkeleton } from "@/components/layout/HeaderAccountArea";
import FooterData, { FooterSkeleton } from "@/components/layout/FooterData";
import IdleLogoutGate from "@/components/auth/IdleLogoutGate";
import ThemeProvider from "@/components/layout/ThemeProvider";
import { getPublicHomeSettings } from "@/lib/data/settings.server";
import { routing } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Hallmark — header rendering refactor (ต่อยอดจาก Hallmark — homepage
 * data-flow optimization และ public homepage caching) เดิม RootLayout เรียก
 * getSessionUser() + getSettings() + getCategories() + (ถ้ามี user)
 * getMyNotifications()/getUnreadNotificationCount() รวมเป็น Promise.all เดียว
 * ที่บล็อกทุก route ทั้งเว็บ — ต้องรอให้ครบทุกตัวก่อน React ถึงจะเริ่ม render
 * อะไรได้เลยแม้แต่ {children} เพราะไม่มี <Suspense> คั่นไว้เลย
 *
 * ตอนนี้ layout เหลือ await หลัก 2 ตัว (getMessages() ของ next-intl ที่ไม่มี
 * network call จริง แค่ import ไฟล์ JSON, และ getPublicHomeSettings() ซึ่ง
 * cache ไว้แล้วผ่าน unstable_cache จาก Hallmark ก่อนหน้าจึงเบามาก ใช้แค่
 * siteName/logoUrl สำหรับโลโก้ใน Header ซึ่งเป็นส่วนหนึ่งของ "เมนูนำทาง
 * สาธารณะ" ที่ควร render ทันทีไม่ต้องมี skeleton กระพริบ) ส่วนที่เหลือทั้งหมด
 * (บัญชีผู้ใช้ x2, Footer, IdleLogout) ย้ายไปเป็น Server Component แยกที่ห่อด้วย
 * <Suspense> ของตัวเอง — {children} (เนื้อหาแต่ละหน้า) จึงเริ่ม stream ได้ทันที
 * โดยไม่ต้องรอข้อมูลบัญชีผู้ใช้ที่ช้ากว่าและเปลี่ยนไปตามแต่ละคนเลย
 *
 * การตรวจสอบสิทธิ์ (role) ทั้งหมดยังคงทำฝั่งเซิร์ฟเวอร์ผ่าน getSessionUser()
 * เหมือนเดิมทุกประการ (ดู components/layout/HeaderAccountArea.tsx,
 * components/auth/IdleLogoutGate.tsx) — middleware.ts ก็ยังตรวจสอบ/ป้องกัน
 * route ที่ต้องมีสิทธิ์เหมือนเดิมทุกประการ ไม่ถูกแตะต้องเลยในงานนี้ ไม่มีการส่ง
 * user/role จาก middleware ผ่าน request header ที่เชื่อถือได้แทนการตรวจสอบ
 * ฝั่งเซิร์ฟเวอร์แต่อย่างใด
 *
 * i18n Phase 0A — <html>/<body> ย้ายขึ้นไปที่ app/layout.tsx (root layout ตัว
 * จริงตามข้อบังคับของ Next.js) ไฟล์นี้เป็น nested layout ที่เพิ่มเฉพาะ
 * NextIntlClientProvider/locale validation เข้ามา ยังไม่มีการแปล string ใน
 * component ใดในรอบนี้ (Phase 0A = infrastructure เท่านั้น ดู
 * file_prompt/i18n-phase-0a-prompt.md) — skip-link, title ฯลฯ ยังเป็นภาษาไทย
 * hardcode เหมือนเดิมทุกประการ
 */
/**
 * <title> ต้องตาม locale จริง — ก่อนหน้านี้ root layout (app/layout.tsx) ใส่
 * metadata แบบ static เป็นภาษาไทย hardcode ทำให้ /en/ และ /lo/ ก็ยังขึ้น
 * browser tab title ภาษาไทยเหมือนกันหมด generateMetadata ที่นี่จึง override
 * เฉพาะ title: locale 'th' ใช้ siteName จาก DB เหมือนเดิม (ตรงกับที่ admin
 * ตั้งค่าไว้ผ่าน settings), ส่วน locale อื่นใช้ header.siteName จาก i18n
 * message file แทน เพราะ DB เก็บชื่อไซต์เป็นภาษาไทยภาษาเดียว
 *
 * ไม่แตะ siteName ที่ส่งเข้า <Header> ด้านล่าง — ยังคงมาจาก DB ทุก locale
 * เหมือนเดิมทุกประการ (คนละจุดกับ <title> ของ browser tab)
 */
export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { siteName: dbSiteName } = await getPublicHomeSettings();

  let siteName: string;
  if (locale === "th") {
    siteName = dbSiteName || "ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร";
  } else {
    const t = await getTranslations({ locale, namespace: "header" });
    siteName = t("siteName");
  }

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const { siteName, logoUrl } = await getPublicHomeSettings();
  const tHeader = await getTranslations("header");

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <a href="#main-content" className="skip-link">
          {tHeader("skipToContent")}
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
    </NextIntlClientProvider>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

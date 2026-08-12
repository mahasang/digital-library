import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  PUBLIC_SETTINGS_TAG,
  PUBLIC_HOME_TAG,
  PUBLIC_HOME_REVALIDATE_SECONDS,
} from "@/lib/cache/public-home";
import type { AppSettings } from "@/types/research";

/** ค่าเริ่มต้น — ใช้เมื่อยังไม่ได้ตั้งค่า Supabase หรือยังไม่มีแถวตั้งค่าในฐานข้อมูล */
export const DEFAULT_SETTINGS: AppSettings = {
  siteName: "ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
  logoUrl: "",
  faviconUrl: "",
  contactEmail: "library@example.org",
  contactPhone: "02-000-0000",
  contactAddress: "อาคารห้องสมุดกลาง มหาวิทยาลัยเทคโนโลยีองค์กร",
  socialFacebook: "",
  socialTwitter: "",
  socialLine: "",
  copyrightText:
    "สงวนลิขสิทธิ์ (ข้อมูลตัวอย่างสำหรับการพัฒนาเท่านั้น)",
  homepageLatestCount: 8,
  homepagePopularCount: 8,
  registrationEnabled: true,
  submissionEnabled: true,
  defaultResearchStatus: "draft",
  captchaEnabled: false,
  notificationsInAppEnabled: true,
  notificationsEmailEnabled: false,
  maxPdfSizeMb: 50,
  maxCoverSizeMb: 5,
  maxAttachmentSizeMb: 20,
  rateLimitRegisterMax: 5,
  rateLimitRegisterWindowSec: 600,
  rateLimitSubmitMax: 10,
  rateLimitSubmitWindowSec: 600,
  accessExpirationWarningDays: 3,
  accessExpirationWarningInAppEnabled: true,
  accessExpirationWarningEmailEnabled: false,
  ocrMaxFileSizeMb: 20,
  ocrMaxPages: 50,
  ocrDailyQuotaEnabled: true,
  ocrMaxJobsPerUserPerDay: 20,
  ocrProviderEnabled: true,
  ocrAllowedAccessLevels: ["public"],
  updatedAt: null,
};

export const SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";

const SETTINGS_COLUMNS =
  "site_name, logo_url, favicon_url, contact_email, contact_phone, contact_address, social_facebook, social_twitter, social_line, copyright_text, homepage_latest_count, homepage_popular_count, registration_enabled, submission_enabled, default_research_status, captcha_enabled, notifications_in_app_enabled, notifications_email_enabled, max_pdf_size_mb, max_cover_size_mb, max_attachment_size_mb, rate_limit_register_max, rate_limit_register_window_sec, rate_limit_submit_max, rate_limit_submit_window_sec, access_expiration_warning_days, access_expiration_warning_in_app_enabled, access_expiration_warning_email_enabled, ocr_max_file_size_mb, ocr_max_pages, ocr_daily_quota_enabled, ocr_max_jobs_per_user_per_day, ocr_provider_enabled, ocr_allowed_access_levels, updated_at";

/**
 * ห่อด้วย React cache() (Hallmark — homepage data-flow optimization) — เดิม
 * เรียกซ้ำ 3 จุดต่อการโหลดหน้าแรกหนึ่งครั้ง (root layout สำหรับ Header/Footer,
 * app/page.tsx, และ Hero.tsx) แต่ละครั้งคือ query จริงไปยัง Supabase cache()
 * ทำให้การเรียกซ้ำภายใน request เดียวกัน (ไม่ว่าจะเรียกจากที่ใด) ได้ผลลัพธ์จาก
 * หน่วยความจำแทนการ query ซ้ำ — ไม่กระทบความสดใหม่ของข้อมูลข้าม request และ
 * ไม่เปลี่ยนพฤติกรรม/ค่าที่คืนเลย เพียงลดจำนวนครั้งที่ query จริงถูกยิงออกไป
 */
export const getSettings = cache(async (): Promise<AppSettings> => {
  if (!isSupabaseConfigured()) {
    return DEFAULT_SETTINGS;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    siteName: data.site_name || DEFAULT_SETTINGS.siteName,
    logoUrl: data.logo_url ?? "",
    faviconUrl: data.favicon_url ?? "",
    contactEmail: data.contact_email ?? DEFAULT_SETTINGS.contactEmail,
    contactPhone: data.contact_phone ?? DEFAULT_SETTINGS.contactPhone,
    contactAddress: data.contact_address ?? DEFAULT_SETTINGS.contactAddress,
    socialFacebook: data.social_facebook ?? "",
    socialTwitter: data.social_twitter ?? "",
    socialLine: data.social_line ?? "",
    copyrightText: data.copyright_text ?? DEFAULT_SETTINGS.copyrightText,
    homepageLatestCount:
      data.homepage_latest_count ?? DEFAULT_SETTINGS.homepageLatestCount,
    homepagePopularCount:
      data.homepage_popular_count ?? DEFAULT_SETTINGS.homepagePopularCount,
    registrationEnabled: data.registration_enabled ?? true,
    submissionEnabled: data.submission_enabled ?? true,
    defaultResearchStatus:
      data.default_research_status === "pending_review" ? "pending_review" : "draft",
    captchaEnabled: data.captcha_enabled ?? false,
    notificationsInAppEnabled: data.notifications_in_app_enabled ?? true,
    notificationsEmailEnabled: data.notifications_email_enabled ?? false,
    maxPdfSizeMb: data.max_pdf_size_mb ?? DEFAULT_SETTINGS.maxPdfSizeMb,
    maxCoverSizeMb: data.max_cover_size_mb ?? DEFAULT_SETTINGS.maxCoverSizeMb,
    maxAttachmentSizeMb: data.max_attachment_size_mb ?? DEFAULT_SETTINGS.maxAttachmentSizeMb,
    rateLimitRegisterMax: data.rate_limit_register_max ?? DEFAULT_SETTINGS.rateLimitRegisterMax,
    rateLimitRegisterWindowSec:
      data.rate_limit_register_window_sec ?? DEFAULT_SETTINGS.rateLimitRegisterWindowSec,
    rateLimitSubmitMax: data.rate_limit_submit_max ?? DEFAULT_SETTINGS.rateLimitSubmitMax,
    rateLimitSubmitWindowSec:
      data.rate_limit_submit_window_sec ?? DEFAULT_SETTINGS.rateLimitSubmitWindowSec,
    accessExpirationWarningDays:
      data.access_expiration_warning_days ?? DEFAULT_SETTINGS.accessExpirationWarningDays,
    accessExpirationWarningInAppEnabled: data.access_expiration_warning_in_app_enabled ?? true,
    accessExpirationWarningEmailEnabled: data.access_expiration_warning_email_enabled ?? false,
    ocrMaxFileSizeMb: data.ocr_max_file_size_mb ?? DEFAULT_SETTINGS.ocrMaxFileSizeMb,
    ocrMaxPages: data.ocr_max_pages ?? DEFAULT_SETTINGS.ocrMaxPages,
    ocrDailyQuotaEnabled: data.ocr_daily_quota_enabled ?? true,
    ocrMaxJobsPerUserPerDay:
      data.ocr_max_jobs_per_user_per_day ?? DEFAULT_SETTINGS.ocrMaxJobsPerUserPerDay,
    ocrProviderEnabled: data.ocr_provider_enabled ?? true,
    ocrAllowedAccessLevels:
      data.ocr_allowed_access_levels ?? DEFAULT_SETTINGS.ocrAllowedAccessLevels,
    updatedAt: data.updated_at ?? null,
  };
});

/**
 * เฉพาะฟิลด์การตั้งค่าที่หน้าแรกสาธารณะแสดงจริง (Hallmark — public homepage
 * caching) — ตั้งใจ**แยกออกจาก getSettings() ด้านบนโดยเจตนา ไม่ใช่แค่เรียก
 * getSettings() แล้วหยิบบางฟิลด์** เพราะ getSettings() ถูกใช้ในเส้นทางตัดสินใจ
 * ทางธุรกิจจริงหลายจุดที่ต้องการค่าล่าสุดเป๊ะเสมอ (เช่น registrationEnabled/
 * captchaEnabled ใน app/register/actions.ts, submissionEnabled ใน
 * app/submit-research/actions.ts, ค่า rate limit/OCR quota ต่างๆ) — ถ้าห่อ
 * getSettings() ทั้งฟังก์ชันด้วย unstable_cache แล้วมีคน admin ปิดรับสมัคร
 * สมาชิกไป ระบบอาจยังรับสมัครสมาชิกใหม่ต่อได้อีกจนกว่า cache จะหมดอายุ — เป็น
 * บั๊กด้านตรรกะธุรกิจจริง ไม่ใช่แค่ข้อมูลหน้าแรกเก่าเฉยๆ จึงต้องแยกฟังก์ชันนี้
 * ออกมาต่างหาก cache เฉพาะ 4 ฟิลด์ที่ Hero/app/page.tsx ใช้จริงเท่านั้น
 * ส่วน getSettings() เดิมยังคง**ไม่ cache เลย** ให้ทุกเส้นทางที่เหลือได้ค่า
 * ล่าสุดเสมอเหมือนเดิมทุกประการ
 */
export interface PublicHomeSettings {
  siteName: string;
  logoUrl: string;
  homepageLatestCount: number;
  homepagePopularCount: number;
}

const PUBLIC_HOME_SETTINGS_COLUMNS =
  "site_name, logo_url, homepage_latest_count, homepage_popular_count";

function toPublicHomeSettings(data: {
  site_name: string | null;
  logo_url: string | null;
  homepage_latest_count: number | null;
  homepage_popular_count: number | null;
} | null): PublicHomeSettings {
  return {
    siteName: data?.site_name || DEFAULT_SETTINGS.siteName,
    logoUrl: data?.logo_url ?? DEFAULT_SETTINGS.logoUrl,
    homepageLatestCount: data?.homepage_latest_count ?? DEFAULT_SETTINGS.homepageLatestCount,
    homepagePopularCount: data?.homepage_popular_count ?? DEFAULT_SETTINGS.homepagePopularCount,
  };
}

async function fetchPublicHomeSettingsFromDb(): Promise<PublicHomeSettings> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("settings")
    .select(PUBLIC_HOME_SETTINGS_COLUMNS)
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error || !data) {
    return toPublicHomeSettings(null);
  }
  return toPublicHomeSettings(data);
}

const getCachedPublicHomeSettings = unstable_cache(
  fetchPublicHomeSettingsFromDb,
  ["public-home-settings"],
  { tags: [PUBLIC_SETTINGS_TAG, PUBLIC_HOME_TAG], revalidate: PUBLIC_HOME_REVALIDATE_SECONDS }
);

/**
 * ใช้โดย app/page.tsx (หน้าแรกสาธารณะ) และ app/layout.tsx (โลโก้/ชื่อเว็บใน
 * Header ทุกหน้า — Hallmark: header rendering refactor) — ดูคอมเมนต์ด้านบน
 * สำหรับเหตุผลที่แยกออกจาก getSettings() เต็มรูปแบบ ทั้งสองจุดใช้ฟิลด์คนละชุด
 * จาก object เดียวกัน (หน้าแรก: homepageLatestCount/homepagePopularCount
 * เพิ่มเติม, layout: siteName/logoUrl เท่านั้น) แชร์ cache เดียวกันได้เลย
 */
export async function getPublicHomeSettings(): Promise<PublicHomeSettings> {
  if (!isSupabaseConfigured()) {
    return toPublicHomeSettings(null);
  }
  return getCachedPublicHomeSettings();
}

import "server-only";
import { getTranslations } from "next-intl/server";

/**
 * แปลง error จาก Postgres/Supabase ให้เป็นข้อความปลอดภัยสำหรับแสดงต่อผู้ใช้
 * ห้ามให้ raw Postgres error, SQL, stack trace หลุดออกไปที่ UI เด็ดขาด
 *
 * ข้อยกเว้นเดียว: error ที่มี code === 'P0001' คือข้อความภาษาไทยที่แอปนี้
 * ตั้งใจ `raise exception ... using errcode = 'P0001'` ขึ้นเองในฝั่งฐานข้อมูล
 * (เช่น กันถอดถอน Super Admin คนสุดท้าย) จึงปลอดภัยที่จะแสดงตรงๆ — error code
 * อื่นทั้งหมด (constraint violation, connection error ฯลฯ) จะถูกแทนที่ด้วย
 * ข้อความทั่วไปเสมอ ส่วนรายละเอียดจริงถูก log ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น
 */

const INTENTIONAL_APP_ERROR_CODE = "P0001";

interface ErrorLike {
  message?: unknown;
  code?: unknown;
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && typeof (error as ErrorLike).message === "string") {
    return (error as ErrorLike).message as string;
  }
  return null;
}

function extractCode(error: unknown): string | null {
  if (error && typeof error === "object" && typeof (error as ErrorLike).code === "string") {
    return (error as ErrorLike).code as string;
  }
  return null;
}

/**
 * @param error error ดิบจาก Supabase (`{ error }` จาก query) หรือ catch block
 * @param fallbackMessage ข้อความทั่วไปที่จะแสดงแทนเมื่อ error ไม่ใช่ข้อความที่ตั้งใจให้ผู้ใช้เห็น
 * @param logContext ป้ายกำกับสั้นๆ สำหรับ console.error ฝั่งเซิร์ฟเวอร์ (ชื่อฟังก์ชัน/Action)
 */
export function toSafeErrorMessage(
  error: unknown,
  fallbackMessage: string,
  logContext: string
): string {
  const rawMessage = extractMessage(error);
  const code = extractCode(error);

  console.error(`${logContext}:`, rawMessage ?? error, code ? `(code: ${code})` : "");

  if (code === INTENTIONAL_APP_ERROR_CODE && rawMessage) {
    return rawMessage;
  }

  return fallbackMessage;
}

/**
 * แปลง error P0001 (ข้อความที่แอปนี้ raise exception ขึ้นเองในฝั่งฐานข้อมูล —
 * ดู comment ด้านบน) จากภาษาไทย hardcode ในตัว migration ให้เป็นข้อความตาม
 * locale ของผู้ใช้ โดย match กับข้อความไทยต้นฉบับ (ยังคงเป็น source of truth
 * เดียวในฐานข้อมูล — ไม่สามารถแก้ SQL ให้ return translation key ได้ตรงๆ)
 * แล้ว map ไปยัง key ใน namespace "sqlErrors" ที่ตรงกัน
 *
 * ใช้แทน toSafeErrorMessage() เฉพาะจุดที่เรียก RPC/trigger ที่รู้ว่าอาจ raise
 * P0001 ด้วยข้อความเหล่านี้จริง — จุดอื่นที่ error ไม่มีทางเป็น P0001 จากชุด
 * ข้อความนี้ ให้ใช้ toSafeErrorMessage() แบบเดิมต่อไป (sync, ไม่ต้องรอ locale)
 */
export async function toSafeErrorMessageLocalized(
  error: unknown,
  fallback: string,
  logContext: string
): Promise<string> {
  const rawMessage = extractMessage(error);
  const code = extractCode(error);

  console.error(`${logContext}:`, rawMessage ?? error, code ? `(code: ${code})` : "");

  if (code === INTENTIONAL_APP_ERROR_CODE && rawMessage) {
    const t = await getTranslations("sqlErrors");
    const msg = rawMessage;

    if (msg.includes("ไม่สามารถถอดถอนสิทธิ์ Super Admin คนสุดท้ายในระบบได้")) return t("cannotRemoveLastSuperAdmin");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขขีดจำกัดของ Storage bucket ได้")) return t("requiresSuperAdminForBucketLimits");
    if (msg.includes("ไม่รู้จัก bucket นี้")) return t("unknownBucket");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขการตั้งค่านี้ได้")) return t("requiresSuperAdminForSettings");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับหมวดหมู่ได้")) return t("requiresSuperAdminForCategoryOrdering");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะย้ายหมวดหมู่ได้")) return t("requiresSuperAdminForCategoryMove");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับหน่วยงานได้")) return t("requiresSuperAdminForOrgOrdering");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับได้")) return t("requiresSuperAdminForOrdering");
    if (msg.includes("หมวดหมู่ไม่สามารถเป็นหมวดหมู่หลักของตัวเองได้")) return t("categoryCannotBeSelfParent");
    if (msg.includes("ไม่สามารถกำหนดหมวดหมู่หลักแบบวนกลับมาที่ตัวเองได้")) return t("categoryCircularReference");
    if (msg.includes("ไม่สามารถเผยแพร่งานวิจัยนี้ได้ เนื่องจากไฟล์ยังไม่ผ่านการตรวจสอบความปลอดภัย")) return t("cannotPublishUnscannedFile");
    if (msg.includes("หน่วยงานไม่สามารถเป็นหน่วยงานหลักของตัวเองได้")) return t("organizationCannotBeSelfParent");
    if (msg.includes("ไม่สามารถกำหนดหน่วยงานหลักแบบวนกลับมาที่ตัวเองได้")) return t("organizationCircularReference");
    if (msg.includes("ต้องมีสิทธิ์บรรณารักษ์ขึ้นไปจึงจะรวมข้อมูลผู้วิจัยได้")) return t("requiresLibrarianForAuthorMerge");
    if (msg.includes("ไม่สามารถรวมผู้วิจัยเข้ากับตัวเองได้")) return t("cannotMergeAuthorWithSelf");
    if (msg.includes("ไม่พบผู้วิจัยที่ระบุ หรือผู้วิจัยถูกรวมข้อมูลไปแล้ว")) return t("authorNotFoundOrMerged");
    if (msg.includes("ต้องมีสิทธิ์บรรณารักษ์ขึ้นไปจึงจะรวมข้อมูลหน่วยงานได้")) return t("requiresLibrarianForOrgMerge");
    if (msg.includes("ไม่สามารถรวมหน่วยงานเข้ากับตัวเองได้")) return t("cannotMergeOrganizationWithSelf");
    if (msg.includes("ไม่พบหน่วยงานที่ระบุ หรือหน่วยงานถูกรวมข้อมูลไปแล้ว")) return t("organizationNotFoundOrMerged");
    if (msg.includes("ต้องมีสิทธิ์ผู้ดูแลระบบขึ้นไปจึงจะรวมงานวิจัยได้")) return t("requiresAdminForResearchMerge");
    if (msg.includes("ไม่สามารถรวมงานวิจัยเข้ากับตัวเองได้")) return t("cannotMergeResearchWithSelf");
    if (msg.includes("ไม่พบงานวิจัยที่ระบุ หรืองานวิจัยถูกรวมไปแล้ว")) return t("researchNotFoundOrMerged");
    if (msg.includes("ต้องเป็น Super Admin เท่านั้นจึงจะปรับเกณฑ์ตรวจข้อมูลซ้ำได้")) return t("requiresSuperAdminForDuplicateRules");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะสั่งลองใหม่ได้")) return t("requiresSuperAdminForRetry");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะสร้างงานประมวลผลเป็นชุดได้")) return t("requiresSuperAdminForBatchCreate");
    if (msg.includes("ต้องมีสิทธิ์ Super Admin จึงจะควบคุมงานประมวลผลเป็นชุดได้")) return t("requiresSuperAdminForBatchControl");
    // 2 ข้อความ parameterized (มี % substitution จาก Postgres) — match แค่ prefix ข้อความคงที่
    if (msg.includes("ไม่สามารถเปลี่ยนสถานะงานชุดนี้เป็น")) return t("invalidStatusTransition");
    if (msg.startsWith("สถานะเป้าหมายไม่ถูกต้อง")) return t("invalidTargetStatus");
    if (msg.includes("not authenticated")) return t("notAuthenticated");

    return msg; // ไม่ match arm ไหนเลย — เข้ากับ toSafeErrorMessage เดิมที่ให้ raw P0001 message ผ่านได้ (ตั้งใจ raise เองจึงปลอดภัย)
  }

  return fallback;
}

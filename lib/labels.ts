import type { AccessLevel, DocumentStatus, ScanStatus, UserRole } from "@/types/research";
import type {
  AccessRequestStatusRow,
  AccessRequestTypeRow,
  ExtractionStatusRow,
  OcrStatusRow,
} from "@/lib/supabase/database.types";

/**
 * @deprecated ใช้ t(`accessLevels.${level}`) จาก next-intl แทน (namespace root
 * หรือ getTranslations('accessLevels') แล้วเรียก t(level)) คงไว้สำหรับหน้าที่
 * ยังไม่ได้แปล — จะลบใน Phase 2B เมื่อทุก call site แปลครบแล้ว
 */
export const accessLevelLabels: Record<AccessLevel, string> = {
  public: "เข้าถึงสาธารณะ",
  member_only: "เฉพาะสมาชิก",
  staff_only: "เฉพาะบุคลากร",
  read_only: "อ่านออนไลน์เท่านั้น",
  metadata_only: "แสดงเฉพาะข้อมูลเบื้องต้น",
};

/**
 * @deprecated ใช้ t(`accessLevels.descriptions.${level}`) จาก next-intl แทน
 * คงไว้สำหรับหน้าที่ยังไม่ได้แปล (เช่น app/[locale]/research/[id]/page.tsx) —
 * จะลบใน Phase 2B
 */
export const accessLevelDescriptions: Record<AccessLevel, string> = {
  public: "ผู้เข้าชมทุกคนสามารถอ่านและดาวน์โหลดเอกสารฉบับเต็มได้",
  member_only: "ต้องเข้าสู่ระบบในฐานะสมาชิกจึงจะอ่านและดาวน์โหลดได้",
  staff_only: "จำกัดเฉพาะบุคลากรขององค์กรเท่านั้น",
  read_only: "อ่านออนไลน์ได้ แต่ไม่อนุญาตให้ดาวน์โหลดไฟล์",
  metadata_only: "แสดงเฉพาะชื่อเรื่อง บทคัดย่อ และข้อมูลผู้วิจัย ไม่สามารถอ่านฉบับเต็ม",
};

/**
 * @deprecated ใช้ t(`statuses.${status}`) จาก next-intl แทน คงไว้สำหรับ
 * sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const statusLabels: Record<DocumentStatus, string> = {
  draft: "ฉบับร่าง",
  pending_review: "รอตรวจสอบ",
  revision_requested: "ขอให้แก้ไข",
  approved: "อนุมัติแล้ว",
  published: "เผยแพร่แล้ว",
  rejected: "ถูกปฏิเสธ",
  archived: "จัดเก็บถาวร",
  merged: "ถูกรวมเข้ากับรายการอื่น",
};

/**
 * @deprecated ใช้ t(`scanStatuses.${status}`) จาก next-intl แทน คงไว้สำหรับ
 * sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const scanStatusLabels: Record<ScanStatus, string> = {
  pending: "รอสแกนความปลอดภัย (background job)",
  clean: "ตรวจสอบแล้ว ปลอดภัย",
  infected: "พบความเสี่ยงด้านความปลอดภัย",
  error: "ตรวจสอบไม่สำเร็จ",
  skipped: "ยังไม่ได้สแกนจริง (โหมดจำลอง/ข้อมูลเก่า)",
};

/**
 * @deprecated ใช้ t(`extractionStatuses.${status}`) จาก next-intl แทน คงไว้
 * สำหรับ sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const extractionStatusLabels: Record<ExtractionStatusRow, string> = {
  pending: "รอประมวลผล",
  processing: "กำลังประมวลผล",
  completed: "สำเร็จ — ค้นหาเนื้อหาได้",
  no_text_found: "ไม่พบข้อความ (อาจเป็นไฟล์สแกน)",
  failed: "ประมวลผลไม่สำเร็จ",
};

/**
 * @deprecated ใช้ t(`ocrStatuses.${status}`) จาก next-intl แทน คงไว้สำหรับ
 * sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const ocrStatusLabels: Record<OcrStatusRow, string> = {
  not_required: "ยังไม่จำเป็นต้อง OCR",
  pending: "รอ OCR",
  processing: "กำลัง OCR",
  completed: "OCR สำเร็จ — ค้นหาเนื้อหาได้ (อาจมีความคลาดเคลื่อน)",
  failed: "OCR ไม่สำเร็จ",
  blocked: "ยังไม่ได้ทำ OCR (ติดปัญหาการตั้งค่า/นโยบาย)",
};

/**
 * @deprecated ใช้ t(`accessRequestTypes.${type}`) จาก next-intl แทน คงไว้
 * สำหรับ sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const accessRequestTypeLabels: Record<AccessRequestTypeRow, string> = {
  read: "อ่านออนไลน์",
  download: "ดาวน์โหลด",
};

/**
 * @deprecated ใช้ t(`accessRequestStatuses.${status}`) จาก next-intl แทน
 * คงไว้สำหรับ sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const accessRequestStatusLabels: Record<AccessRequestStatusRow, string> = {
  pending: "รอตรวจสอบ",
  under_review: "กำลังพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ถูกปฏิเสธ",
  more_information_required: "ต้องการข้อมูลเพิ่มเติม",
  cancelled: "ยกเลิกโดยผู้ขอ",
  expired: "สิทธิ์หมดอายุ",
};

/**
 * @deprecated ใช้ t(`roles.${role}`) จาก next-intl แทน คงไว้สำหรับ sub-pages
 * ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const roleLabels: Record<UserRole, string> = {
  guest: "ผู้เยี่ยมชม",
  member: "สมาชิก",
  staff: "บุคลากร",
  librarian: "บรรณารักษ์",
  admin: "ผู้ดูแลระบบ",
  super_admin: "ผู้ดูแลระบบสูงสุด",
};

/**
 * ป้ายกำกับภาษาไทยของ action ในตาราง audit_logs — ใช้ร่วมกันทั้ง
 * /dashboard/audit-logs และ /superadmin/audit-logs
 * @deprecated ใช้ t(`auditActions.${action}`) จาก next-intl แทน คงไว้สำหรับ
 * sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const auditActionLabels: Record<string, string> = {
  research_create: "สร้างงานวิจัย",
  research_update: "แก้ไขงานวิจัย",
  research_status_change: "เปลี่ยนสถานะงานวิจัย",
  category_create: "เพิ่มหมวดหมู่",
  category_update: "แก้ไขหมวดหมู่",
  category_enable: "เปิดใช้งานหมวดหมู่",
  category_disable: "ปิดใช้งานหมวดหมู่",
  category_delete: "ลบหมวดหมู่",
  category_reorder: "จัดลำดับหมวดหมู่",
  category_move_parent: "ย้ายหมวดหมู่",
  organization_create: "เพิ่มหน่วยงาน",
  organization_update: "แก้ไขหน่วยงาน",
  organization_enable: "เปิดใช้งานหน่วยงาน",
  organization_disable: "ปิดใช้งานหน่วยงาน",
  organization_delete: "ลบหน่วยงาน",
  organization_reorder: "จัดลำดับหน่วยงาน",
  user_role_change: "เปลี่ยนบทบาทผู้ใช้",
  user_role_add: "เพิ่มบทบาทผู้ใช้",
  user_role_remove: "ถอดถอนบทบาทผู้ใช้",
  super_admin_grant: "มอบสิทธิ์ Super Admin",
  super_admin_revoke: "ถอดถอนสิทธิ์ Super Admin",
  user_enable: "เปิดใช้งานบัญชี",
  user_disable: "ระงับบัญชี",
  user_suspend: "ระงับบัญชี",
  user_suspend_temporary: "ระงับบัญชีชั่วคราว",
  settings_update: "แก้ไขการตั้งค่าระบบ",
  system_settings_update: "แก้ไขการตั้งค่าระบบขั้นสูง",
  security_settings_update: "แก้ไขการตั้งค่าความปลอดภัย",
  notification_settings_update: "แก้ไขการตั้งค่าการแจ้งเตือน",
  storage_file_delete: "ลบไฟล์ค้างใน Storage",
  file_upload_rejected: "ปฏิเสธไฟล์อัปโหลด (ตรวจสอบไม่ผ่าน/พบความเสี่ยง)",
  mfa_reset: "รีเซ็ต MFA ของผู้ใช้",
  research_text_reprocess: "สั่งประมวลผลข้อความ PDF ใหม่",
  access_request_approve: "อนุมัติคำขอเข้าถึงเอกสาร",
  access_request_reject: "ปฏิเสธคำขอเข้าถึงเอกสาร",
  access_request_more_info: "ขอข้อมูลเพิ่มเติมสำหรับคำขอเข้าถึงเอกสาร",
  access_request_cancel: "ยกเลิกคำขอเข้าถึงเอกสาร",
  access_grant_revoke: "เพิกถอนสิทธิ์เข้าถึงเอกสาร",
  author_create: "เพิ่มผู้วิจัย",
  author_update: "แก้ไขผู้วิจัย",
  author_enable: "เปิดใช้งานผู้วิจัย",
  author_disable: "ปิดใช้งานผู้วิจัย",
  author_orcid_verify: "ยืนยัน ORCID ของผู้วิจัย",
  author_merge: "รวมข้อมูลผู้วิจัย",
  organization_merge: "รวมข้อมูลหน่วยงาน",
  research_merge: "รวมงานวิจัย",
  duplicate_review_confirm: "ยืนยันว่างานวิจัยซ้ำกัน",
  duplicate_review_dismiss: "ยืนยันว่างานวิจัยไม่ซ้ำกัน",
};

export function canDownload(accessLevel: AccessLevel): boolean {
  return accessLevel !== "read_only" && accessLevel !== "metadata_only";
}

export function canReadOnline(accessLevel: AccessLevel): boolean {
  return accessLevel !== "metadata_only";
}

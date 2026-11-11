import type { Organization } from "@/types/research";

/**
 * ค่าเริ่มต้นของช่อง "หน่วยงาน" ในฟอร์มส่ง/แก้ไขงานวิจัย
 *
 * ฟอร์มเก็บ `organizationId` เป็น uuid ของหน่วยงาน แต่ข้อมูลงานวิจัยเดิมที่ใช้
 * เติมฟอร์มตอน "แก้ไข" (ResearchItem.organization) เก็บเป็น "ชื่อหน่วยงานภาษาไทย"
 * ไม่ใช่ id — ถ้าไม่แปลงกลับ ฟอร์มจะเลือกหน่วยงานแรกในรายการเสมอ และการกดบันทึก
 * จะเปลี่ยนหน่วยงานของงานโดยผู้ใช้ไม่รู้ตัว
 *
 * จับคู่ด้วยชื่อ (nameTh) แบบตรงทุกตัวอักษร ถ้าไม่พบ (เช่น หน่วยงานถูกปิดใช้งาน/
 * งานใหม่ที่ยังไม่มีข้อมูลเดิม) จึงตกไปที่หน่วยงานแรกในรายการเหมือนเดิม
 */
export function resolveInitialOrganizationId(
  organizations: Pick<Organization, "id" | "nameTh">[],
  currentOrganizationName?: string | null
): string {
  const name = currentOrganizationName?.trim();
  if (name) {
    const match = organizations.find((organization) => organization.nameTh === name);
    if (match) return match.id;
  }
  return organizations[0]?.id ?? "";
}

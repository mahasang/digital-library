"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import type { ActionResult } from "@/lib/actions/types";

const CLEANABLE_BUCKETS = ["research-documents", "research-covers", "submission-attachments"];

/**
 * ลบไฟล์ที่ไม่มีการอ้างอิงในฐานข้อมูล — ต้องยืนยันฝั่ง client ก่อนเรียก (ปุ่ม
 * confirm) การลบจริงใช้สิทธิ์ผ่าน Storage RLS ปกติ (super_admin rank >= 50
 * ผ่านเกณฑ์ rank >= 40 ที่ policy ลบไฟล์ของทุก bucket กำหนดไว้อยู่แล้ว
 * ไม่ต้องใช้ Service Role) — ก่อนลบตรวจสอบซ้ำว่ายังไม่มีการอ้างอิงจริง
 * เพื่อป้องกัน race condition ที่มีคนอัปโหลด/บันทึกอ้างอิงไฟล์นี้ระหว่างที่
 * super_admin กำลังดูรายการอยู่
 */
export async function deleteOrphanedFileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const bucketId = String(formData.get("bucketId") || "");
  const path = String(formData.get("path") || "");

  if (!CLEANABLE_BUCKETS.includes(bucketId) || !path) {
    return { status: "error", message: "ข้อมูลไม่ถูกต้อง" };
  }

  const supabase = await createClient();

  const column =
    bucketId === "research-documents"
      ? "pdf_file"
      : bucketId === "submission-attachments"
        ? "attachment_file"
        : null;

  if (column) {
    const { count } = await supabase
      .from("research_items")
      .select("id", { count: "exact", head: true })
      .eq(column, path);
    if ((count ?? 0) > 0) {
      return {
        status: "error",
        message: "ไฟล์นี้มีการอ้างอิงในฐานข้อมูลแล้ว (อาจเพิ่งถูกบันทึกใช้งาน) ไม่ได้ลบให้",
      };
    }
  } else {
    const { count } = await supabase
      .from("research_items")
      .select("id", { count: "exact", head: true })
      .like("cover_image", `%${path}`);
    if ((count ?? 0) > 0) {
      return {
        status: "error",
        message: "ไฟล์นี้มีการอ้างอิงในฐานข้อมูลแล้ว (อาจเพิ่งถูกบันทึกใช้งาน) ไม่ได้ลบให้",
      };
    }
  }

  const { error } = await supabase.storage.from(bucketId).remove([path]);
  if (error) {
    console.error("deleteOrphanedFileAction failed:", error.message);
    return { status: "error", message: "ไม่สามารถลบไฟล์ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "storage_file_delete",
    entityType: "storage_objects",
    metadata: { bucket_id: bucketId, path },
  });

  revalidatePath("/superadmin/storage");
  return { status: "success", message: "ลบไฟล์เรียบร้อยแล้ว" };
}

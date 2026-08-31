"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/profile";
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_ALLOWED_EXTENSIONS,
  DEFAULT_AVATAR_MAX_SIZE_MB,
  isExtensionMatchingMimeType,
  isExtensionAllowed,
  mbToBytes,
} from "@/lib/storage/limits";
import type { ActionResult } from "@/lib/actions/types";

export async function updateProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    organization: formData.get("organization") || undefined,
    phone: formData.get("phone") || "",
    dateOfBirth: formData.get("dateOfBirth") || "",
    address: formData.get("address") || "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      organization_name: parsed.data.organization ?? null,
      phone: parsed.data.phone ?? null,
      date_of_birth: parsed.data.dateOfBirth ?? null,
      address: parsed.data.address ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/account");
  return { status: "success", message: "บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว" };
}

/**
 * อัปโหลดรูปโปรไฟล์ — ผ่าน Server Action ตรงๆ (ไม่ผ่าน client-side upload แบบ
 * PDF งานวิจัย) เพราะไฟล์เล็ก (≤5MB ตาม bucket avatars ใน
 * supabase/migrations/20260831120000_add_profile_fields.sql) ไม่มีปัญหาเรื่อง
 * โอนไฟล์ผ่านเซิร์ฟเวอร์สองทอดเหมือน PDF ขนาดใหญ่
 *
 * path คงที่ {uid}/avatar.{ext} ต่อผู้ใช้หนึ่งคนเสมอ (upsert:true) — ต่างจาก
 * research-covers/research-documents ที่ใช้ {uid}/{draftKey}/{timestamp}-...
 * เพราะที่นี่ไม่มีแนวคิด "แบบร่าง" ต้องการแค่รูปเดียวต่อคนที่แทนที่ของเดิมได้เสมอ
 */
export async function updateAvatarAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "กรุณาเลือกไฟล์รูปภาพ" };
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return {
      status: "error",
      message: `ชนิดไฟล์ไม่ถูกต้อง รองรับเฉพาะ ${AVATAR_ALLOWED_TYPES.join(", ")}`,
    };
  }
  if (!isExtensionMatchingMimeType(file.name, file.type)) {
    return {
      status: "error",
      message: "นามสกุลไฟล์ไม่ตรงกับชนิดไฟล์ที่ตรวจพบ กรุณาตรวจสอบไฟล์อีกครั้ง",
    };
  }
  if (file.size > mbToBytes(DEFAULT_AVATAR_MAX_SIZE_MB)) {
    return {
      status: "error",
      message: `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${DEFAULT_AVATAR_MAX_SIZE_MB}MB)`,
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!isExtensionAllowed(`x.${ext}`, AVATAR_ALLOWED_EXTENSIONS)) {
    return { status: "error", message: "นามสกุลไฟล์ไม่ถูกต้อง" };
  }
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

  if (uploadError) {
    return { status: "error", message: "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // กัน CDN/browser cache เดิมของ path เดียวกัน (upsert ทับไฟล์แต่ URL ไม่เปลี่ยน)
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: cacheBustedUrl })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: "ไม่สามารถบันทึกรูปโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/account");
  return { status: "success", message: "อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว" };
}

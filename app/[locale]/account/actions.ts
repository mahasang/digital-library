"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toSafeErrorMessageLocalized } from "@/lib/errors/safe-message.server";
import { createProfileSchema, createChangePasswordSchema } from "@/lib/validation/profile";
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_ALLOWED_EXTENSIONS,
  DEFAULT_AVATAR_MAX_SIZE_MB,
  isExtensionMatchingMimeType,
  isExtensionAllowed,
  mbToBytes,
} from "@/lib/storage/limits";
import { getReadingHistory } from "@/lib/data/favorites.server";
import type { ActionResult } from "@/lib/actions/types";
import type { ResearchItem } from "@/types/research";

export async function updateProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAccount = await getTranslations("actionMessages.account");
  const tValidation = await getTranslations("validation");
  const parsed = createProfileSchema(tValidation).safeParse({
    fullName: formData.get("fullName"),
    organization: formData.get("organization") || undefined,
    phone: formData.get("phone") || "",
    dateOfBirth: formData.get("dateOfBirth") || "",
    address: formData.get("address") || "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormData"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: t("mustLogIn") };
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
    return { status: "error", message: tAccount("profileSaveFailed") };
  }

  revalidatePath("/account");
  return { status: "success", message: tAccount("profileSavedSuccess") };
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
  const t = await getTranslations("actionMessages.common");
  const tAccount = await getTranslations("actionMessages.account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: t("mustLogIn") };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: tAccount("selectImageFile") };
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return {
      status: "error",
      message: tAccount("avatarTypeInvalid", { types: AVATAR_ALLOWED_TYPES.join(", ") }),
    };
  }
  if (!isExtensionMatchingMimeType(file.name, file.type)) {
    return { status: "error", message: tAccount("avatarExtensionMismatch") };
  }
  if (file.size > mbToBytes(DEFAULT_AVATAR_MAX_SIZE_MB)) {
    return {
      status: "error",
      message: tAccount("avatarTooLarge", { max: DEFAULT_AVATAR_MAX_SIZE_MB }),
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!isExtensionAllowed(`x.${ext}`, AVATAR_ALLOWED_EXTENSIONS)) {
    return { status: "error", message: tAccount("avatarExtensionInvalid") };
  }
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

  if (uploadError) {
    return { status: "error", message: tAccount("avatarUploadFailed") };
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
    return { status: "error", message: tAccount("avatarSaveFailed") };
  }

  revalidatePath("/account");
  return { status: "success", message: tAccount("avatarUpdatedSuccess") };
}

export interface ReadingHistoryEntry {
  id: string;
  readAt: string;
  research: ResearchItem;
}

/** ประวัติการอ่านแบบ dedupe เอาแค่ครั้งล่าสุดต่อชิ้น — ใช้ getReadingHistory()
 * เดิมจาก lib/data/favorites.server.ts (มี fetchPublishedResearchRowsByIds
 * กรองเฉพาะงานวิจัยที่ยัง published อยู่ให้แล้ว และ mapRowToResearchItem
 * ให้ field ตรงกับที่ใช้ทั่วแอปอยู่แล้ว) แทนการ query ตรงๆ ซ้ำอีกที — ฟังก์ชัน
 * เดิมไม่ dedupe (คืนทุกครั้งที่อ่าน อาจซ้ำชิ้นเดียวกันหลายแถว) เพราะหน้า
 * /reading-history เดิมต้องการแบบนั้น จึง dedupe ที่ชั้นนี้แทนที่จะแก้ฟังก์ชัน
 * ที่ใช้ร่วมกัน — ผลลัพธ์เรียง read_at ล่าสุดก่อนอยู่แล้ว จึง dedupe แบบเก็บ
 * รายการแรกที่เจอต่อ id ได้เลย (คือครั้งล่าสุดเสมอ) */
export async function getReadingHistoryAction(): Promise<ReadingHistoryEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const history = await getReadingHistory(user.id);

  const seen = new Set<string>();
  const deduped: ReadingHistoryEntry[] = [];
  for (const { item, readAt } of history) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push({ id: item.id, readAt, research: item });
  }
  return deduped;
}

/** ลบประวัติการอ่านทั้งหมดของผู้ใช้ปัจจุบัน — ต้องมี reading_history_delete_own
 * policy (migration 20260901100000) เพราะเดิม reading_history มีแค่
 * select/insert policy ไม่มี delete policy เลยแม้จะมี GRANT delete ระดับ
 * ตารางให้ authenticated อยู่แล้วก็ตาม (RLS ปฏิเสธทุกแถวโดยปริยายถ้าไม่มี
 * policy ตรงกับ operation) */
export async function clearReadingHistoryAction(): Promise<{ error: string | null }> {
  const t = await getTranslations("actionMessages.common");
  if (!isSupabaseConfigured()) {
    return { error: t("supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: t("mustLogIn") };
  }

  const { error } = await supabase.from("reading_history").delete().eq("user_id", user.id);

  if (error) {
    console.error("clearReadingHistoryAction failed:", error.message);
    const tAccount = await getTranslations("actionMessages.account");
    return { error: tAccount("readingHistoryDeleteFailed") };
  }

  revalidatePath("/account");
  // /reading-history เป็นหน้าแยกที่ใช้ getReadingHistory() ตัวเดียวกัน — revalidate
  // ด้วยเพื่อไม่ให้แสดงประวัติเก่าที่ถูกลบไปแล้วค้างอยู่จาก cache เดิม
  revalidatePath("/reading-history");
  return { error: null };
}

/** ลบบัญชีถาวรผ่าน RPC delete_own_account() (migration 20260904140000) —
 * security definer เพราะการลบ auth.users ต้องใช้สิทธิ์ที่ authenticated role
 * ธรรมดาไม่มี ฟังก์ชันใช้ auth.uid() ของผู้เรียกเองเท่านั้น ไม่รับ parameter
 * ใดๆ จึงลบได้เฉพาะบัญชีตัวเอง — comments/ratings ที่เคยสร้างไว้จะไม่ถูกลบ
 * ตาม แค่ set user_id เป็น null (anonymize) ตาม FK ที่แก้ไว้ในระดับ column
 * ส่วนข้อมูลส่วนตัวอื่น (favorites/reading_history/notification_preferences
 * ฯลฯ) cascade ลบไปพร้อม profiles ตามปกติ — ยืนยันพฤติกรรมนี้แล้วด้วยการ
 * ทดสอบจริงกับ user ทดสอบก่อน implement ฝั่ง UI */
export async function deleteAccountAction(): Promise<{ error: string | null }> {
  const t = await getTranslations("actionMessages.common");
  const tAccount = await getTranslations("actionMessages.account");
  if (!isSupabaseConfigured()) {
    return { error: t("supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("mustLogIn") };

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { error: await toSafeErrorMessageLocalized(error, tAccount("deleteAccountFailed"), "deleteAccountAction failed") };
  }

  await supabase.auth.signOut();
  return { error: null };
}

// useActionState style — form with field errors
export async function changePasswordAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAccount = await getTranslations("actionMessages.account");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const tValidation = await getTranslations("validation");
  const parsed = createChangePasswordSchema(tValidation).safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidData"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) return { status: "error", message: tAccount("passwordChangeFailed") };
  return { status: "success", message: tAccount("passwordChangedSuccess") };
}

// imperative style — standalone button like deleteAccountAction
export async function signOutAllDevicesAction(): Promise<{ error: string | null }> {
  const t = await getTranslations("actionMessages.common");
  const tAccount = await getTranslations("actionMessages.account");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t("mustLogIn") };

  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { error: tAccount("signOutAllFailed") };
  return { error: null };
}

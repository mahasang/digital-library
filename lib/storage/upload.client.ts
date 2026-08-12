"use client";

import { createClient } from "@/lib/supabase/client";
import { buildStoragePath } from "@/lib/storage/paths";

export type StorageBucket =
  | "research-documents"
  | "research-covers"
  | "submission-attachments"
  | "site-assets";

interface UploadResult {
  path: string | null;
  error: string | null;
}

/**
 * อัปโหลดไฟล์จาก Browser ตรงไปยัง Supabase Storage (ผ่าน Storage RLS Policy
 * ที่กำหนดไว้ใน migration) โดยไม่ผ่านเซิร์ฟเวอร์ของแอป — เหมาะสำหรับไฟล์ขนาดใหญ่
 * อย่าง PDF เพราะไม่ต้องส่งข้อมูลไฟล์ผ่าน Next.js server เป็นทอดที่สอง
 */
export async function uploadResearchFile(
  bucket: StorageBucket,
  uid: string,
  draftKey: string,
  file: File
): Promise<UploadResult> {
  const supabase = createClient();
  const path = buildStoragePath(uid, draftKey, file);

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error(`uploadResearchFile failed for ${bucket}/${path}:`, error.message);
    return { path: null, error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  return { path, error: null };
}

export async function removeResearchFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([path]);
}

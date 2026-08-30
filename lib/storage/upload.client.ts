"use client";

import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
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

/**
 * อัปโหลดไฟล์แบบ resumable ผ่าน Supabase Storage TUS endpoint
 * (`/storage/v1/upload/resumable`) แทน uploadResearchFile() ด้านบน — ให้
 * ความคืบหน้าจริงตาม byte ที่โอนแล้วจริง (onProgress) และ resume ได้เองถ้า
 * เน็ตหลุดกลางทาง (fingerprint-based, ดู tus-js-client docs) ต่างจาก
 * uploadResearchFile() เดิมที่ใช้ supabase.storage.upload() (มาจาก fetch()
 * ภายใน ไม่มี progress event ใดๆ เลย — ดูเหตุผลเต็มใน
 * file_prompt/tus-upload-progress.md)
 *
 * ใช้ path convention เดียวกับ uploadResearchFile() ทุกประการ
 * ({uid}/{draftKey}/{timestamp}-{filename} ผ่าน buildStoragePath()) เพราะ
 * Storage RLS policy ของทุก bucket ที่ฟังก์ชันนี้ใช้ตรวจ
 * (storage.foldername(name))[1] = auth.uid()::text เสมอ (ดู
 * supabase/migrations/20260801100100_storage_buckets.sql) — TUS เป็นแค่
 * โปรโตคอลอัปโหลดอีกแบบเข้า storage.objects ตารางเดียวกัน ไม่ได้ข้าม RLS
 * เดิมแต่อย่างใด จึงต้องผ่าน path เดียวกันเป๊ะ ไม่ใช่ path ที่ TUS สร้างเอง
 *
 * คืนค่าเป็น "storage path" ดิบเหมือน uploadResearchFile() เสมอ (ไม่ใช่
 * public URL เต็ม) เพราะโค้ดฝั่งเซิร์ฟเวอร์ที่รับค่านี้ต่อ (เช่น
 * app/[locale]/submit-research/actions.ts) เป็นผู้เรียก getPublicUrl()/สร้าง
 * signed URL เองจาก path อีกที — ถ้าคืน public URL ไปตรงๆ จะเป็นการคำนวณ
 * URL ซ้ำซ้อนผิดรูปแบบที่โค้ดฝั่งเซิร์ฟเวอร์คาดหวัง
 */
export function uploadResearchFileTus(
  bucket: StorageBucket,
  uid: string,
  draftKey: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const path = buildStoragePath(uid, draftKey, file);

  return new Promise((resolve) => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        resolve({ path: null, error: "กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนอัปโหลดไฟล์" });
        return;
      }

      const { url: supabaseUrl, anonKey } = getSupabaseEnv();

      const upload = new tus.Upload(file, {
        endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type,
          cacheControl: "3600",
        },
        // Supabase resumable upload กำหนดขนาด chunk คงที่ 6MB (ผูกกับ S3
        // multipart upload ภายใน) — ห้ามเปลี่ยนเป็นค่าอื่น
        chunkSize: 6 * 1024 * 1024,
        onError: (error) => {
          console.error(`uploadResearchFileTus failed for ${bucket}/${path}:`, error.message);
          resolve({ path: null, error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onSuccess: () => {
          resolve({ path, error: null });
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  });
}

export async function removeResearchFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([path]);
}

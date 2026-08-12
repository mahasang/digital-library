/**
 * รูปแบบพาธไฟล์มาตรฐานที่ใช้ร่วมกันทุก Storage bucket: {uid}/{draftKey}/{filename}
 * ส่วนแรก (uid) ใช้เป็นฐานของ Storage RLS Policy (ตรวจสอบความเป็นเจ้าของไฟล์)
 * draftKey คือรหัสสุ่มต่อการส่งหนึ่งครั้ง (สร้างก่อนที่จะมีแถว research_items จริง)
 */
export function createDraftKey(): string {
  return crypto.randomUUID();
}

export function buildStoragePath(
  uid: string,
  draftKey: string,
  file: File
): string {
  const safeName = file.name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-100);
  return `${uid}/${draftKey}/${Date.now()}-${safeName}`;
}

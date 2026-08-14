"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { authorSchema } from "@/lib/validation/author";
import { validateOrcid } from "@/lib/validation/orcid";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { lookupOrcidPublicRecord } from "@/lib/orcid/orcid-public-api.server";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit.server";
import type { ActionResult } from "@/lib/actions/types";

const ORCID_API_CACHE_MS = 24 * 60 * 60 * 1000;

function parseAuthorForm(formData: FormData) {
  return authorSchema.safeParse({
    name: formData.get("name"),
    displayNameEn: formData.get("displayNameEn") || undefined,
    titlePrefixTh: formData.get("titlePrefixTh") || undefined,
    titlePrefixEn: formData.get("titlePrefixEn") || undefined,
    organizationId: formData.get("organizationId") || undefined,
    orcid: formData.get("orcid") || undefined,
    biography: formData.get("biography") || undefined,
  });
}

export async function createAuthorAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const parsed = parseAuthorForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const orcid = parsed.data.orcid ? validateOrcid(parsed.data.orcid).formatted : null;

  const { data: inserted, error } = await supabase
    .from("authors")
    .insert({
      name: parsed.data.name,
      display_name_en: parsed.data.displayNameEn || null,
      title_prefix_th: parsed.data.titlePrefixTh || null,
      title_prefix_en: parsed.data.titlePrefixEn || null,
      organization_id: parsed.data.organizationId || null,
      orcid,
      biography: parsed.data.biography || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return { status: "error", message: "ORCID นี้ถูกใช้กับผู้วิจัยคนอื่นในระบบแล้ว" };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถเพิ่มผู้วิจัยได้ กรุณาลองใหม่อีกครั้ง", "createAuthorAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_create",
    entityType: "authors",
    entityId: inserted.id,
    metadata: { name: parsed.data.name, orcid },
  });

  revalidatePath("/dashboard/authors");
  return { status: "success", message: "เพิ่มผู้วิจัยเรียบร้อยแล้ว" };
}

export async function updateAuthorAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const parsed = parseAuthorForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const orcid = parsed.data.orcid ? validateOrcid(parsed.data.orcid).formatted : null;

  const { data: existing } = await supabase.from("authors").select("orcid").eq("id", authorId).maybeSingle();

  const { error } = await supabase
    .from("authors")
    .update({
      name: parsed.data.name,
      display_name_en: parsed.data.displayNameEn || null,
      title_prefix_th: parsed.data.titlePrefixTh || null,
      title_prefix_en: parsed.data.titlePrefixEn || null,
      organization_id: parsed.data.organizationId || null,
      orcid,
      // เปลี่ยน ORCID แล้วต้องยืนยันใหม่เสมอ (ล้างสถานะ "ตรวจสอบแล้ว" เดิม)
      ...(existing?.orcid !== orcid ? { orcid_verified_at: null } : {}),
      biography: parsed.data.biography || null,
    })
    .eq("id", authorId);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "ORCID นี้ถูกใช้กับผู้วิจัยคนอื่นในระบบแล้ว" };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถแก้ไขผู้วิจัยได้ กรุณาลองใหม่อีกครั้ง", "updateAuthorAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_update",
    entityType: "authors",
    entityId: authorId,
    metadata: { name: parsed.data.name, orcid },
  });

  revalidatePath(`/dashboard/authors/${authorId}`);
  revalidatePath("/dashboard/authors");
  return { status: "success", message: "บันทึกการแก้ไขเรียบร้อยแล้ว" };
}

export async function toggleAuthorActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const authorId = String(formData.get("authorId") || "");
  const nextActive = formData.get("nextActive") === "true";
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { error } = await supabase.from("authors").update({ is_active: nextActive }).eq("id", authorId);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง", "toggleAuthorActiveAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: nextActive ? "author_enable" : "author_disable",
    entityType: "authors",
    entityId: authorId,
    metadata: {},
  });

  revalidatePath(`/dashboard/authors/${authorId}`);
  revalidatePath("/dashboard/authors");
  return { status: "success", message: nextActive ? "เปิดใช้งานผู้วิจัยแล้ว" : "ปิดใช้งานผู้วิจัยแล้ว" };
}

/** เจ้าหน้าที่ยืนยันว่าตรวจสอบ ORCID นี้ด้วยตนเองแล้ว — ไม่ใช่การยืนยันจาก
 * ORCID API จริง (ยังไม่ได้เชื่อมต่อ ดู docs/orcid-integration.md) */
export async function verifyOrcidAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: author } = await supabase.from("authors").select("orcid").eq("id", authorId).maybeSingle();
  if (!author?.orcid) {
    return { status: "error", message: "ผู้วิจัยนี้ยังไม่มี ORCID ให้ยืนยัน" };
  }

  const { error } = await supabase
    .from("authors")
    .update({ orcid_verified_at: new Date().toISOString() })
    .eq("id", authorId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถบันทึกการยืนยันได้ กรุณาลองใหม่อีกครั้ง", "verifyOrcidAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_orcid_verify",
    entityType: "authors",
    entityId: authorId,
    metadata: { orcid: author.orcid },
  });

  revalidatePath(`/dashboard/authors/${authorId}`);
  return { status: "success", message: "ยืนยัน ORCID เรียบร้อยแล้ว" };
}

/**
 * ตรวจสอบ ORCID iD ของผู้วิจัยกับ ORCID Public API (อ่านอย่างเดียว) — แสดงเป็น
 * "ข้อมูลแนะนำสำหรับตรวจสอบ" เท่านั้น เขียนได้แค่คอลัมน์ cache
 * orcid_api_checked_at/orcid_api_public_name ไม่เคยเขียนทับ
 * name/display_name_en/organization_id/orcid_verified_at/
 * orcid_oauth_verified_at โดยอัตโนมัติ — เจ้าหน้าที่ต้องใช้ปุ่ม "ยืนยัน ORCID"
 * (verifyOrcidAction) หรือฟอร์มแก้ไขผู้วิจัยเดิม (updateAuthorAction) ที่มีอยู่
 * แล้วเพื่อบันทึกการเปลี่ยนแปลงจริงด้วยตนเองเสมอ ดู docs/orcid-integration.md §6
 */
export async function checkOrcidPublicApiAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const authorId = String(formData.get("authorId") || "");
  const forceRefresh = formData.get("forceRefresh") === "true";
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: author } = await supabase
    .from("authors")
    .select("orcid, orcid_api_checked_at")
    .eq("id", authorId)
    .maybeSingle();
  if (!author?.orcid) {
    return { status: "error", message: "ผู้วิจัยนี้ยังไม่มี ORCID ให้ตรวจสอบ" };
  }

  if (!forceRefresh && author.orcid_api_checked_at) {
    const checkedAtMs = new Date(author.orcid_api_checked_at).getTime();
    if (Date.now() - checkedAtMs < ORCID_API_CACHE_MS) {
      return { status: "success", message: "ใช้ผลตรวจสอบล่าสุด (ตรวจไปเมื่อไม่เกิน 24 ชั่วโมงที่แล้ว)" };
    }
  }

  const { allowed } = await checkRateLimit(rateLimitKeyForUser("orcid_lookup", user.id), 30, 3600);
  if (!allowed) {
    return { status: "error", message: "เรียกตรวจสอบ ORCID บ่อยเกินไป กรุณาลองใหม่ภายหลัง" };
  }

  const result = await lookupOrcidPublicRecord(author.orcid);

  if (result.status === "not_configured") {
    return { status: "error", message: "ยังไม่ได้ตั้งค่า ORCID Public API" };
  }

  const publicName =
    result.status === "found"
      ? result.creditName || [result.givenNames, result.familyName].filter(Boolean).join(" ") || null
      : null;

  const { error } = await supabase
    .from("authors")
    .update({
      orcid_api_checked_at: new Date().toISOString(),
      orcid_api_public_name: publicName,
    })
    .eq("id", authorId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถบันทึกผลตรวจสอบได้ กรุณาลองใหม่อีกครั้ง", "checkOrcidPublicApiAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_orcid_api_check",
    entityType: "authors",
    entityId: authorId,
    metadata: { orcid: author.orcid, resultStatus: result.status },
  });

  revalidatePath(`/dashboard/authors/${authorId}`);

  const messageByStatus: Record<string, string> = {
    found: "ตรวจสอบ ORCID สำเร็จ พบชื่อสาธารณะ — โปรดเปรียบเทียบกับข้อมูลในระบบก่อนยืนยัน",
    not_found: "ไม่พบ ORCID iD นี้ในระบบ ORCID",
    no_public_data: "ORCID iD นี้มีอยู่จริง แต่ไม่ได้เปิดเผยชื่อต่อสาธารณะ",
    rate_limited: "ORCID จำกัดอัตราการเรียกชั่วคราว กรุณาลองใหม่ภายหลัง",
    error: "ระบบ ORCID ไม่ตอบสนอง กรุณาลองใหม่ภายหลัง",
    invalid_format: "รูปแบบ ORCID ในระบบไม่ถูกต้อง กรุณาแก้ไขก่อน",
  };

  return { status: "success", message: messageByStatus[result.status] ?? "ตรวจสอบเสร็จสิ้น" };
}

/**
 * เชื่อมบัญชีผู้ใช้ (profiles) เข้ากับข้อมูลผู้วิจัย (authors.profile_id) —
 * เจ้าหน้าที่เป็นผู้เชื่อมเท่านั้น (ไม่ให้ผู้วิจัยอ้างตัวเป็นคนอื่นเองได้) จาก
 * นั้นผู้วิจัยจะเห็นปุ่ม "เชื่อม ORCID" ที่หน้า /account ของตัวเอง — ค้นหาด้วย
 * อีเมลที่ลงทะเบียนไว้แล้วในระบบเท่านั้น (ไม่สร้างบัญชีใหม่)
 */
export async function linkAuthorProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const authorId = String(formData.get("authorId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };
  if (!email) return { status: "error", message: "กรุณากรอกอีเมลบัญชีผู้ใช้ที่ต้องการเชื่อม" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!targetProfile) {
    return { status: "error", message: "ไม่พบบัญชีผู้ใช้ที่ใช้อีเมลนี้ในระบบ" };
  }

  const { error } = await supabase
    .from("authors")
    .update({ profile_id: targetProfile.id })
    .eq("id", authorId);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "บัญชีนี้ถูกเชื่อมกับผู้วิจัยคนอื่นอยู่แล้ว" };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถเชื่อมบัญชีได้ กรุณาลองใหม่อีกครั้ง", "linkAuthorProfileAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_profile_link",
    entityType: "authors",
    entityId: authorId,
    metadata: { linked_email: targetProfile.email, linked_profile_id: targetProfile.id },
  });

  revalidatePath(`/dashboard/authors/${authorId}`);
  return { status: "success", message: `เชื่อมบัญชีของ ${targetProfile.full_name || targetProfile.email} เรียบร้อยแล้ว` };
}

export async function unlinkAuthorProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: "ไม่พบผู้วิจัยนี้" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { error } = await supabase.from("authors").update({ profile_id: null }).eq("id", authorId);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถยกเลิกการเชื่อมได้ กรุณาลองใหม่อีกครั้ง", "unlinkAuthorProfileAction failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "author_profile_unlink",
    entityType: "authors",
    entityId: authorId,
    metadata: {},
  });

  revalidatePath(`/dashboard/authors/${authorId}`);
  return { status: "success", message: "ยกเลิกการเชื่อมบัญชีเรียบร้อยแล้ว" };
}

/** รวมผู้วิจัย — เรียก merge_authors() RPC (ตรวจสิทธิ์ rank >= 30 ซ้ำในตัว
 * ฟังก์ชันเองอีกชั้นเสมอ) */
export async function mergeAuthorsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) return { status: "error", message: "กรุณาเลือกผู้วิจัยหลักที่จะรวมเข้าด้วย" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: sourceAuthor } = await supabase
    .from("authors")
    .select("name")
    .eq("id", sourceId)
    .maybeSingle();
  if (!sourceAuthor || confirmText !== sourceAuthor.name.trim()) {
    return { status: "error", message: "กรุณาพิมพ์ชื่อผู้วิจัยให้ตรงกันเพื่อยืนยันการรวมข้อมูล" };
  }

  const { error } = await supabase.rpc("merge_authors", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || null,
  });

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถรวมผู้วิจัยได้ กรุณาลองใหม่อีกครั้ง", "mergeAuthorsAction failed"),
    };
  }

  revalidatePath("/dashboard/authors");
  revalidatePath(`/dashboard/authors/${sourceId}`);
  revalidatePath(`/dashboard/authors/${targetId}`);
  return { status: "success", message: "รวมข้อมูลผู้วิจัยเรียบร้อยแล้ว" };
}

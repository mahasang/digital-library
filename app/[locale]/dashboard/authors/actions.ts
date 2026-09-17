"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { createAuthorSchema } from "@/lib/validation/author";
import { validateOrcid } from "@/lib/validation/orcid";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage, toSafeErrorMessageLocalized } from "@/lib/errors/safe-message.server";
import { lookupOrcidPublicRecord } from "@/lib/orcid/orcid-public-api.server";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit.server";
import type { ActionResult } from "@/lib/actions/types";

const ORCID_API_CACHE_MS = 24 * 60 * 60 * 1000;

function parseAuthorForm(formData: FormData, tValidation: Awaited<ReturnType<typeof getTranslations>>) {
  return createAuthorSchema(tValidation).safeParse({
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
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const tValidation = await getTranslations("validation");
  const parsed = parseAuthorForm(formData, tValidation);
  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
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
      return { status: "error", message: tAuthors("orcidAlreadyUsed") };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("createFailed"), "createAuthorAction failed"),
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
  return { status: "success", message: tAuthors("createSuccess") };
}

export async function updateAuthorAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: tAuthors("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const tValidation = await getTranslations("validation");
  const parsed = parseAuthorForm(formData, tValidation);
  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
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
      return { status: "error", message: tAuthors("orcidAlreadyUsed") };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("updateFailed"), "updateAuthorAction failed"),
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
  return { status: "success", message: t("editSavedSuccess") };
}

export async function toggleAuthorActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const authorId = String(formData.get("authorId") || "");
  const nextActive = formData.get("nextActive") === "true";
  if (!authorId) return { status: "error", message: tAuthors("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { error } = await supabase.from("authors").update({ is_active: nextActive }).eq("id", authorId);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("toggleFailed"), "toggleAuthorActiveAction failed"),
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
  return { status: "success", message: nextActive ? tAuthors("enabledSuccess") : tAuthors("disabledSuccess") };
}

/** เจ้าหน้าที่ยืนยันว่าตรวจสอบ ORCID นี้ด้วยตนเองแล้ว — ไม่ใช่การยืนยันจาก
 * ORCID API จริง (ยังไม่ได้เชื่อมต่อ ดู docs/orcid-integration.md) */
export async function verifyOrcidAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: tAuthors("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { data: author } = await supabase.from("authors").select("orcid").eq("id", authorId).maybeSingle();
  if (!author?.orcid) {
    return { status: "error", message: tAuthors("noOrcidToVerify") };
  }

  const { error } = await supabase
    .from("authors")
    .update({ orcid_verified_at: new Date().toISOString() })
    .eq("id", authorId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("verifyFailed"), "verifyOrcidAction failed"),
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
  return { status: "success", message: tAuthors("verifySuccess") };
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
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const authorId = String(formData.get("authorId") || "");
  const forceRefresh = formData.get("forceRefresh") === "true";
  if (!authorId) return { status: "error", message: tAuthors("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { data: author } = await supabase
    .from("authors")
    .select("orcid, orcid_api_checked_at")
    .eq("id", authorId)
    .maybeSingle();
  if (!author?.orcid) {
    return { status: "error", message: tAuthors("noOrcidToCheck") };
  }

  if (!forceRefresh && author.orcid_api_checked_at) {
    const checkedAtMs = new Date(author.orcid_api_checked_at).getTime();
    if (Date.now() - checkedAtMs < ORCID_API_CACHE_MS) {
      return { status: "success", message: tAuthors("checkCacheHit") };
    }
  }

  const { allowed } = await checkRateLimit(rateLimitKeyForUser("orcid_lookup", user.id), 30, 3600);
  if (!allowed) {
    return { status: "error", message: tAuthors("checkRateLimited") };
  }

  const result = await lookupOrcidPublicRecord(author.orcid);

  if (result.status === "not_configured") {
    return { status: "error", message: tAuthors("orcidApiNotConfigured") };
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
      message: toSafeErrorMessage(error, tAuthors("checkSaveFailed"), "checkOrcidPublicApiAction failed"),
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
    found: tAuthors("checkResultFound"),
    not_found: tAuthors("checkResultNotFound"),
    no_public_data: tAuthors("checkResultNoPublicData"),
    rate_limited: tAuthors("checkResultRateLimited"),
    error: tAuthors("checkResultError"),
    invalid_format: tAuthors("checkResultInvalidFormat"),
  };

  return { status: "success", message: messageByStatus[result.status] ?? tAuthors("checkResultDefault") };
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
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const authorId = String(formData.get("authorId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!authorId) return { status: "error", message: tAuthors("notFound") };
  if (!email) return { status: "error", message: tAuthors("linkEmailRequired") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!targetProfile) {
    return { status: "error", message: tAuthors("linkProfileNotFound") };
  }

  const { error } = await supabase
    .from("authors")
    .update({ profile_id: targetProfile.id })
    .eq("id", authorId);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: tAuthors("linkAlreadyLinked") };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("linkFailed"), "linkAuthorProfileAction failed"),
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
  return {
    status: "success",
    message: tAuthors("linkSuccess", { name: targetProfile.full_name || targetProfile.email || "" }),
  };
}

export async function unlinkAuthorProfileAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const authorId = String(formData.get("authorId") || "");
  if (!authorId) return { status: "error", message: tAuthors("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { error } = await supabase.from("authors").update({ profile_id: null }).eq("id", authorId);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, tAuthors("unlinkFailed"), "unlinkAuthorProfileAction failed"),
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
  return { status: "success", message: tAuthors("unlinkSuccess") };
}

/** รวมผู้วิจัย — เรียก merge_authors() RPC (ตรวจสิทธิ์ rank >= 30 ซ้ำในตัว
 * ฟังก์ชันเองอีกชั้นเสมอ) */
export async function mergeAuthorsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuthors = await getTranslations("actionMessages.authors");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) return { status: "error", message: tAuthors("mergeSelectRequired") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { data: sourceAuthor } = await supabase
    .from("authors")
    .select("name")
    .eq("id", sourceId)
    .maybeSingle();
  if (!sourceAuthor || confirmText !== sourceAuthor.name.trim()) {
    return { status: "error", message: tAuthors("mergeConfirmTextMismatch") };
  }

  const { error } = await supabase.rpc("merge_authors", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || undefined,
  });

  if (error) {
    return {
      status: "error",
      message: await toSafeErrorMessageLocalized(error, tAuthors("mergeFailed"), "mergeAuthorsAction failed"),
    };
  }

  revalidatePath("/dashboard/authors");
  revalidatePath(`/dashboard/authors/${sourceId}`);
  revalidatePath(`/dashboard/authors/${targetId}`);
  return { status: "success", message: tAuthors("mergeSuccess") };
}

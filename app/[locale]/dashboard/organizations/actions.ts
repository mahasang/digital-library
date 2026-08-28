"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { revalidatePublicOrganizations } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || `organization-${Date.now().toString(36)}`
  );
}

export async function createOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const nameTh = String(formData.get("nameTh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const organizationCode = String(formData.get("organizationCode") || "").trim();
  const websiteUrl = String(formData.get("websiteUrl") || "").trim();

  if (!nameTh) {
    return { status: "error", message: "กรุณากรอกชื่อหน่วยงานภาษาไทย" };
  }

  const supabase = await createClient();
  const slug = slugify(nameEn || nameTh);

  const { data: inserted, error } = await supabase
    .from("organizations")
    .insert({
      slug,
      name_th: nameTh,
      name_en: nameEn || null,
      description: description || null,
      parent_id: parentId || null,
      organization_code: organizationCode || null,
      website_url: websiteUrl || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถเพิ่มหน่วยงานได้ ชื่ออาจซ้ำกับหน่วยงานที่มีอยู่",
        "createOrganizationAction insert failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "organization_create",
    entityType: "organizations",
    entityId: inserted.id,
    metadata: { name_th: nameTh, slug },
  });

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: "เพิ่มหน่วยงานเรียบร้อยแล้ว" };
}

export async function updateOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const nameTh = String(formData.get("nameTh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const organizationCode = String(formData.get("organizationCode") || "").trim();
  const websiteUrl = String(formData.get("websiteUrl") || "").trim();

  if (!id || !nameTh) {
    return { status: "error", message: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }
  if (parentId === id) {
    return { status: "error", message: "หน่วยงานไม่สามารถเป็นหน่วยงานหลักของตัวเองได้" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name_th: nameTh,
      name_en: nameEn || null,
      description: description || null,
      parent_id: parentId || null,
      organization_code: organizationCode || null,
      website_url: websiteUrl || null,
    })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง",
        "updateOrganizationAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "organization_update",
    entityType: "organizations",
    entityId: id,
    metadata: { name_th: nameTh },
  });

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: "บันทึกการแก้ไขเรียบร้อยแล้ว" };
}

export async function toggleOrganizationActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const nextActive = formData.get("nextActive") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถเปลี่ยนสถานะได้ กรุณาลองใหม่อีกครั้ง",
        "toggleOrganizationActiveAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: nextActive ? "organization_enable" : "organization_disable",
    entityType: "organizations",
    entityId: id,
  });

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: nextActive ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว" };
}

export async function deleteOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const supabase = await createClient();

  const { count } = await supabase
    .from("research_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", id);

  if ((count ?? 0) > 0) {
    return {
      status: "error",
      message: `ลบไม่ได้เนื่องจากมีงานวิจัยผูกอยู่ ${count} รายการ กรุณาปิดใช้งานแทน`,
    };
  }

  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถลบหน่วยงานได้ กรุณาลองใหม่อีกครั้ง",
        "deleteOrganizationAction delete failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "organization_delete",
    entityType: "organizations",
    entityId: id,
  });

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: "ลบหน่วยงานเรียบร้อยแล้ว" };
}

/** รวมหน่วยงาน — เรียก merge_organizations() RPC (ตรวจสิทธิ์ rank >= 30 ซ้ำใน
 * ตัวฟังก์ชันเองอีกชั้นเสมอ) */
export async function mergeOrganizationsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) {
    return { status: "error", message: "กรุณาเลือกหน่วยงานหลักที่จะรวมเข้าด้วย" };
  }

  const supabase = await createClient();

  const { data: sourceOrg } = await supabase
    .from("organizations")
    .select("name_th")
    .eq("id", sourceId)
    .maybeSingle();
  if (!sourceOrg || confirmText !== sourceOrg.name_th.trim()) {
    return { status: "error", message: "กรุณาพิมพ์ชื่อหน่วยงานให้ตรงกันเพื่อยืนยันการรวมข้อมูล" };
  }

  const { error } = await supabase.rpc("merge_organizations", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || null,
  });

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถรวมหน่วยงานได้ กรุณาลองใหม่อีกครั้ง",
        "mergeOrganizationsAction failed"
      ),
    };
  }

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: "รวมข้อมูลหน่วยงานเรียบร้อยแล้ว" };
}

"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage, toSafeErrorMessageLocalized } from "@/lib/errors/safe-message.server";
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
  const tOrganizations = await getTranslations("actionMessages.organizations");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const nameTh = String(formData.get("nameTh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const organizationCode = String(formData.get("organizationCode") || "").trim();
  const websiteUrl = String(formData.get("websiteUrl") || "").trim();

  if (!nameTh) {
    return { status: "error", message: tOrganizations("nameRequired") };
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
        tOrganizations("createFailed"),
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
  return { status: "success", message: tOrganizations("createSuccess") };
}

export async function updateOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tOrganizations = await getTranslations("actionMessages.organizations");
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
    return { status: "error", message: t("fillAllFields") };
  }
  if (parentId === id) {
    return { status: "error", message: tOrganizations("selfParent") };
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
      message: await toSafeErrorMessageLocalized(
        error,
        t("editSaveFailed"),
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
  return { status: "success", message: t("editSavedSuccess") };
}

export async function toggleOrganizationActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
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
        t("toggleStatusFailed"),
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
  return { status: "success", message: nextActive ? t("enabledSuccess") : t("disabledSuccess") };
}

export async function deleteOrganizationAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tOrganizations = await getTranslations("actionMessages.organizations");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const supabase = await createClient();

  const { count } = await supabase
    .from("research_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", id);

  if ((count ?? 0) > 0) {
    return { status: "error", message: t("linkedResearchCount", { count: count ?? 0 }) };
  }

  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tOrganizations("deleteFailed"),
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
  return { status: "success", message: tOrganizations("deleteSuccess") };
}

/** รวมหน่วยงาน — เรียก merge_organizations() RPC (ตรวจสิทธิ์ rank >= 30 ซ้ำใน
 * ตัวฟังก์ชันเองอีกชั้นเสมอ) */
export async function mergeOrganizationsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const tOrganizations = await getTranslations("actionMessages.organizations");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) {
    return { status: "error", message: tOrganizations("mergeSelectRequired") };
  }

  const supabase = await createClient();

  const { data: sourceOrg } = await supabase
    .from("organizations")
    .select("name_th")
    .eq("id", sourceId)
    .maybeSingle();
  if (!sourceOrg || confirmText !== sourceOrg.name_th.trim()) {
    return { status: "error", message: tOrganizations("mergeConfirmTextMismatch") };
  }

  const { error } = await supabase.rpc("merge_organizations", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || null,
  });

  if (error) {
    return {
      status: "error",
      message: await toSafeErrorMessageLocalized(
        error,
        tOrganizations("mergeFailed"),
        "mergeOrganizationsAction failed"
      ),
    };
  }

  revalidatePath("/dashboard/organizations");
  revalidatePath("/", "layout");
  revalidatePublicOrganizations();
  return { status: "success", message: tOrganizations("mergeSuccess") };
}

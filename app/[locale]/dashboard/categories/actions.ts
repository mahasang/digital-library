"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { revalidatePublicCategories } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || `category-${Date.now().toString(36)}`
  );
}

export async function createCategoryAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const tCategories = await getTranslations("actionMessages.categories");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const nameTh = String(formData.get("nameTh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const icon = String(formData.get("icon") || "").trim();
  const parentId = String(formData.get("parentId") || "") || null;

  if (!nameTh || !nameEn) {
    return { status: "error", message: tCategories("namesRequired") };
  }

  const supabase = await createClient();
  const slug = slugify(nameEn);

  const { data: inserted, error } = await supabase
    .from("categories")
    .insert({
      slug,
      name_th: nameTh,
      name_en: nameEn,
      description: description || null,
      icon: icon || null,
      parent_id: parentId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tCategories("createFailed"),
        "createCategoryAction insert failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "category_create",
    entityType: "categories",
    entityId: inserted.id,
    metadata: { name_th: nameTh, slug },
  });

  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");  // revalidate หน้าแรกทุก locale
  revalidatePublicCategories();
  return { status: "success", message: tCategories("createSuccess") };
}

export async function updateCategoryAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tCategories = await getTranslations("actionMessages.categories");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const nameTh = String(formData.get("nameTh") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const icon = String(formData.get("icon") || "").trim();
  const parentId = String(formData.get("parentId") || "") || null;

  if (!id || !nameTh || !nameEn) {
    return { status: "error", message: t("fillAllFields") };
  }
  if (parentId === id) {
    return { status: "error", message: tCategories("selfParent") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name_th: nameTh,
      name_en: nameEn,
      description: description || null,
      icon: icon || null,
      parent_id: parentId,
    })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        t("editSaveFailed"),
        "updateCategoryAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "category_update",
    entityType: "categories",
    entityId: id,
    metadata: { name_th: nameTh },
  });

  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");
  revalidatePublicCategories();
  return { status: "success", message: t("editSavedSuccess") };
}

export async function toggleCategoryActiveAction(
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
    .from("categories")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        t("toggleStatusFailed"),
        "toggleCategoryActiveAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: nextActive ? "category_enable" : "category_disable",
    entityType: "categories",
    entityId: id,
  });

  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");
  revalidatePublicCategories();
  return { status: "success", message: nextActive ? t("enabledSuccess") : t("disabledSuccess") };
}

export async function deleteCategoryAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tCategories = await getTranslations("actionMessages.categories");
  const auth = await requireMinRank(30);
  if (!auth.ok) return auth.result;

  const id = String(formData.get("id") || "");
  const supabase = await createClient();

  const { count } = await supabase
    .from("research_categories")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if ((count ?? 0) > 0) {
    return { status: "error", message: t("linkedResearchCount", { count: count ?? 0 }) };
  }

  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if ((childCount ?? 0) > 0) {
    return { status: "error", message: tCategories("deleteBlockedByChildren") };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tCategories("deleteFailed"),
        "deleteCategoryAction delete failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "category_delete",
    entityType: "categories",
    entityId: id,
  });

  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");
  revalidatePublicCategories();
  return { status: "success", message: tCategories("deleteSuccess") };
}

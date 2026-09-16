"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessageLocalized } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * จัดลำดับหมวดหมู่ภายในกลุ่ม parent เดียวกัน (ไม่เปลี่ยน parent_id) — เรียกจาก
 * client component ตอนลากวางเสร็จโดยตรง (ไม่ผ่าน <form>) จึงรับ argument
 * ปกติแทนรูปแบบ (prevState, formData) ของ useActionState
 *
 * ใช้ RPC `superadmin_reorder_categories` (security definer, ตรวจสอบ rank
 * >= 50 ซ้ำอีกชั้นในฐานข้อมูล + ทำงานเป็น transaction เดียว) — การตรวจสอบ
 * สิทธิ์ที่แท้จริงอยู่ที่ requireMinRank() ด้านล่างนี้และ RPC ฝั่งฐานข้อมูล
 * ไม่ใช่ที่ client
 */
export async function reorderCategoriesAction(
  parentId: string | null,
  orderedIds: string[]
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tCategories = await getTranslations("actionMessages.superadmin.categories");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  if (orderedIds.length === 0) {
    return { status: "error", message: t("noItemsToReorder") };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("superadmin_reorder_categories", {
    p_parent_id: parentId,
    p_ordered_ids: orderedIds,
  });

  if (error) {
    return {
      status: "error",
      message: await toSafeErrorMessageLocalized(
        error,
        tCategories("reorderFailed"),
        "reorderCategoriesAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "category_reorder",
    entityType: "categories",
    entityId: parentId ?? undefined,
    metadata: { parent_id: parentId, ordered_ids: orderedIds },
  });

  revalidatePath("/superadmin/categories");
  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");
  return { status: "success", message: tCategories("reorderSuccess") };
}

/**
 * ย้ายหมวดหมู่ไปยังหมวดหมู่หลักใหม่ พร้อมจัดลำดับกลุ่มปลายทางในคราวเดียว —
 * `orderedIds` ต้องเป็นรายการ id ทั้งหมดของกลุ่มปลายทางหลังย้าย (รวม
 * categoryId ที่ย้ายด้วย) trigger `prevent_category_cycle` ในฐานข้อมูลป้องกัน
 * การสร้างความสัมพันธ์วนซ้ำให้อัตโนมัติ
 */
export async function moveCategoryAction(
  categoryId: string,
  newParentId: string | null,
  orderedIds: string[]
): Promise<ActionResult> {
  const tCategories = await getTranslations("actionMessages.superadmin.categories");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("superadmin_move_category", {
    p_category_id: categoryId,
    p_new_parent_id: newParentId,
    p_ordered_ids: orderedIds,
  });

  if (error) {
    return {
      status: "error",
      message: await toSafeErrorMessageLocalized(
        error,
        tCategories("moveFailed"),
        "moveCategoryAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "category_move_parent",
    entityType: "categories",
    entityId: categoryId,
    metadata: { new_parent_id: newParentId, ordered_ids: orderedIds },
  });

  revalidatePath("/superadmin/categories");
  revalidatePath("/dashboard/categories");
  revalidatePath("/", "layout");
  return { status: "success", message: tCategories("moveSuccess") };
}

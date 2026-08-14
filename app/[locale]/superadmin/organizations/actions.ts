"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

/** จัดลำดับหน่วยงานทั้งหมด — เรียกจาก client component ตอนลากวางเสร็จโดยตรง */
export async function reorderOrganizationsAction(
  orderedIds: string[]
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  if (orderedIds.length === 0) {
    return { status: "error", message: "ไม่มีรายการให้จัดลำดับ" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("superadmin_reorder_organizations", {
    p_ordered_ids: orderedIds,
  });

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถจัดลำดับหน่วยงานได้ กรุณาลองใหม่อีกครั้ง",
        "reorderOrganizationsAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "organization_reorder",
    entityType: "organizations",
    metadata: { ordered_ids: orderedIds },
  });

  revalidatePath("/superadmin/organizations");
  revalidatePath("/dashboard/organizations");
  revalidatePath("/submit-research");
  return { status: "success", message: "จัดลำดับหน่วยงานเรียบร้อยแล้ว" };
}

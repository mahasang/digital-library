"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";

export async function deleteBlogCommentAction(id: string): Promise<{ error?: string }> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return { error: "ບໍ່ມີສິດໃຊ້ງານ" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[dashboard/blog-comments] delete error:", error.message);
    return { error: "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່" };
  }

  revalidatePath("/dashboard/blog-comments");
  return {};
}

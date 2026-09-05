"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";

export type ContactMessageStatus = "unread" | "read" | "replied";

export async function updateContactMessageStatusAction(
  id: string,
  status: ContactMessageStatus
): Promise<{ error?: string }> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return { error: "ບໍ່ມີສິດໃຊ້ງານ" };

  const supabase = await createClient();
  const { error } = await supabase
  .from("contact_messages")
  .update({ status })
  .eq("id", id);

  if (error) {
    console.error("[contact-messages] update error:", error.message);
    return { error: "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່" };
  }

  revalidatePath("/dashboard/contact-messages");
  return {};
}
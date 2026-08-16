"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSettings } from "@/lib/data/settings.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { notifyResearchPublished } from "@/lib/publishing/publish-event.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { revalidatePublicResearch } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";
import type { DocumentStatus } from "@/types/research";

async function changeStatus(
  researchId: string,
  newStatus: DocumentStatus,
  note?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  if (!researchId) {
    return { status: "error", message: "ไม่พบรหัสงานวิจัย" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: updated, error } = await supabase
    .from("research_items")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      review_note: note ?? null,
    })
    .eq("id", researchId)
    .select("title_th, submitted_by")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถเปลี่ยนสถานะได้ กรุณาลองใหม่อีกครั้ง",
        "changeStatus failed"
      ),
    };
  }

  // ส่งอีเมลแจ้งผู้ส่งงานวิจัย (best-effort — ไม่ทำให้การเปลี่ยนสถานะล้มเหลวหาก
  // ส่งอีเมลไม่สำเร็จ เนื่องจากสถานะเปลี่ยนไปแล้วจริงและมีการแจ้งเตือนในระบบ
  // จาก database trigger ให้แล้วเสมอ)
  if (updated?.submitted_by) {
    try {
      const settings = await getSettings();
      if (settings.notificationsEmailEnabled) {
        const { data: submitterProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", updated.submitted_by)
          .maybeSingle();
        if (submitterProfile?.email) {
          const locale = await getLocale();
          const tStatuses = await getTranslations({ locale, namespace: "statuses" });
          await sendNotificationEmail({
            to: submitterProfile.email,
            subject: `สถานะงานวิจัยเปลี่ยนแปลง: ${updated.title_th}`,
            text: `งานวิจัย "${updated.title_th}" ของคุณเปลี่ยนสถานะเป็น "${tStatuses(newStatus)}"${note ? `\n\nหมายเหตุ: ${note}` : ""}`,
          });
        }
      }
    } catch (emailError) {
      console.error("changeStatus: email notification failed:", emailError);
    }
  }

  // แจ้งผู้ติดตามหมวดหมู่ (in-app + email) เมื่อเผยแพร่ใหม่ — ผ่านจุดกลางเดียว
  // ร่วมกับทุกเส้นทางที่เผยแพร่ได้ (ดู lib/publishing/publish-event.server.ts)
  if (newStatus === "published" && updated?.title_th) {
    await notifyResearchPublished(supabase, {
      researchItemId: researchId,
      titleTh: updated.title_th,
      submittedBy: updated.submitted_by,
      actorId: user.id,
      source: "approval",
    });
  }

  revalidatePath(`/dashboard/approvals/${researchId}`);
  revalidatePath("/dashboard/approvals");
  revalidatePath(`/my-submissions/${researchId}`);
  // เปลี่ยนสถานะทุกครั้ง (ไม่ว่าจะเป็นการเผยแพร่/เก็บถาวร/อนุมัติ/ปฏิเสธ/ขอแก้ไข)
  // อาจกระทบชุดข้อมูลสาธารณะของหน้าแรก — ล้าง cache แบบไม่มีเงื่อนไขไว้ก่อนเสมอ
  // (ถูกกว่าการลืมล้างมาก ดู lib/cache/public-home.ts)
  revalidatePublicResearch();

  return { status: "success", message: "เปลี่ยนสถานะเรียบร้อยแล้ว" };
}

export async function approveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "approved");
}

export async function rejectAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    return { status: "error", message: "กรุณาระบุเหตุผลที่ปฏิเสธงานวิจัยนี้" };
  }
  return changeStatus(String(formData.get("researchId") || ""), "rejected", note);
}

export async function requestRevisionAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    return { status: "error", message: "กรุณาระบุรายละเอียดที่ต้องการให้แก้ไข" };
  }
  return changeStatus(
    String(formData.get("researchId") || ""),
    "revision_requested",
    note
  );
}

export async function publishAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "published");
}

export async function archiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "archived");
}

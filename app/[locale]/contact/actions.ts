"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function submitContactAction(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "actionMessages" });

  const firstName = (formData.get("first_name") as string | null)?.trim() ?? "";
  const lastName  = (formData.get("last_name")  as string | null)?.trim() ?? "";
  const email     = (formData.get("email")       as string | null)?.trim() ?? "";
  const phone     = (formData.get("phone")       as string | null)?.trim() ?? "";
  const message   = (formData.get("message")     as string | null)?.trim() ?? "";

  // ── Validate ──
  if (!firstName || !lastName || !email || !message) {
    return { status: "error", message: t("contact.fillAllFields") };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: "error", message: t("contact.invalidEmailFormat") };
  }
  if (message.length < 10) {
    return { status: "error", message: t("contact.messageTooShort") };
  }

  // ── Insert Supabase ──
  const supabase = await createClient();
  const { error: dbError } = await supabase
  .from("contact_messages")
  .insert({ first_name: firstName, last_name: lastName, email, phone: phone || null, message });

  if (dbError) {
    console.error("[contact] db error:", dbError.message);
    return { status: "error", message: t("contact.genericError") };
  }

  // ── Send email via Resend ──
  const adminEmail = process.env.ADMIN_CONTACT_EMAIL ?? "iconsilisid@gmail.com";
  const fromEmail  = process.env.RESEND_FROM_EMAIL   ?? "onboarding@resend.dev";

  try {
    await resend.emails.send({
      from: fromEmail,
      to:   adminEmail,
      subject: `[ຕິດຕໍ່ໃໝ່] ${firstName} ${lastName}`,
      html: `
        <h2>ຂໍ້ຄວາມຕິດຕໍ່ໃໝ່</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%">
          <tr><td><strong>ຊື່:</strong></td><td>${firstName} ${lastName}</td></tr>
          <tr><td><strong>ອີເມວ:</strong></td><td>${email}</td></tr>
          <tr><td><strong>ເບີໂທ:</strong></td><td>${phone || "—"}</td></tr>
          <tr><td><strong>ຂໍ້ຄວາມ:</strong></td><td style="white-space:pre-wrap">${message}</td></tr>
        </table>
      `,
    });
  } catch (emailError) {
    // email fail ไม่ rollback — ข้อมูลบันทึก DB แล้ว log ไว้เท่านั้น
    console.error("[contact] resend error:", emailError);
  }

  return { status: "success" };
}
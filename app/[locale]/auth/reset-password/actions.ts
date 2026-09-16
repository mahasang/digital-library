"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { createResetPasswordSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/actions/types";

export async function resetPasswordAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfiguredDetailed") };
  }

  const tValidation = await getTranslations("validation");
  const parsed = createResetPasswordSchema(tValidation).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const tAuth = await getTranslations("actionMessages.auth");
    return { status: "error", message: tAuth("resetPasswordInvalidLink") };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: await mapAuthErrorMessage(error.message) };
  }

  const locale = await getLocale();
  return redirect({ href: "/login?reset=success", locale });
}

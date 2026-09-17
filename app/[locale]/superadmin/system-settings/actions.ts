"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { SETTINGS_ROW_ID } from "@/lib/data/settings.server";
import { toSafeErrorMessageLocalized } from "@/lib/errors/safe-message.server";
import { createSystemSettingsSchema } from "@/lib/validation/system-settings";
import { revalidatePublicSettings } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";

export async function updateSystemSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tSystemSettings = await getTranslations("actionMessages.superadmin.systemSettings");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const tValidation = await getTranslations("validation");
  const parsed = createSystemSettingsSchema(tValidation).safeParse({
    siteName: formData.get("siteName"),
    contactEmail: formData.get("contactEmail") || "",
    contactPhone: formData.get("contactPhone") || "",
    contactAddress: formData.get("contactAddress") || "",
    socialFacebook: formData.get("socialFacebook") || "",
    socialTwitter: formData.get("socialTwitter") || "",
    socialLine: formData.get("socialLine") || "",
    copyrightText: formData.get("copyrightText") || "",
    homepageLatestCount: formData.get("homepageLatestCount"),
    homepagePopularCount: formData.get("homepagePopularCount"),
    registrationEnabled: formData.get("registrationEnabled") === "true",
    submissionEnabled: formData.get("submissionEnabled") === "true",
    defaultResearchStatus: formData.get("defaultResearchStatus"),
    maxPdfSizeMb: formData.get("maxPdfSizeMb"),
    maxCoverSizeMb: formData.get("maxCoverSizeMb"),
    maxAttachmentSizeMb: formData.get("maxAttachmentSizeMb"),
    logoPath: formData.get("logoPath") || undefined,
    faviconPath: formData.get("faviconPath") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("settings")
    .select("logo_url, favicon_url")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  let logoUrl = existing?.logo_url ?? null;
  if (parsed.data.logoPath) {
    const { data } = supabase.storage.from("site-assets").getPublicUrl(parsed.data.logoPath);
    logoUrl = data.publicUrl;
  }

  let faviconUrl = existing?.favicon_url ?? null;
  if (parsed.data.faviconPath) {
    const { data } = supabase.storage.from("site-assets").getPublicUrl(parsed.data.faviconPath);
    faviconUrl = data.publicUrl;
  }

  const { error } = await supabase
    .from("settings")
    .update({
      site_name: parsed.data.siteName,
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      contact_email: parsed.data.contactEmail || null,
      contact_phone: parsed.data.contactPhone || null,
      contact_address: parsed.data.contactAddress || null,
      social_facebook: parsed.data.socialFacebook || null,
      social_twitter: parsed.data.socialTwitter || null,
      social_line: parsed.data.socialLine || null,
      copyright_text: parsed.data.copyrightText || null,
      homepage_latest_count: parsed.data.homepageLatestCount,
      homepage_popular_count: parsed.data.homepagePopularCount,
      registration_enabled: parsed.data.registrationEnabled,
      submission_enabled: parsed.data.submissionEnabled,
      default_research_status: parsed.data.defaultResearchStatus,
      max_pdf_size_mb: parsed.data.maxPdfSizeMb,
      max_cover_size_mb: parsed.data.maxCoverSizeMb,
      max_attachment_size_mb: parsed.data.maxAttachmentSizeMb,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    return {
      status: "error",
      message: await toSafeErrorMessageLocalized(error, t("saveSettingsFailed"), "updateSystemSettingsAction failed"),
    };
  }

  let bucketSyncWarning: string | null = null;
  try {
    const bucketUpdates = await Promise.all([
      supabase.rpc("superadmin_update_bucket_limit", {
        p_bucket_id: "research-documents",
        p_size_limit_bytes: parsed.data.maxPdfSizeMb * 1024 * 1024,
      }),
      supabase.rpc("superadmin_update_bucket_limit", {
        p_bucket_id: "research-covers",
        p_size_limit_bytes: parsed.data.maxCoverSizeMb * 1024 * 1024,
      }),
      supabase.rpc("superadmin_update_bucket_limit", {
        p_bucket_id: "submission-attachments",
        p_size_limit_bytes: parsed.data.maxAttachmentSizeMb * 1024 * 1024,
      }),
    ]);
    const failed = bucketUpdates.find((r) => r.error);
    if (failed?.error) throw failed.error;
  } catch (err) {
    bucketSyncWarning = await toSafeErrorMessageLocalized(
      err,
      tSystemSettings("bucketSyncWarning"),
      "updateSystemSettingsAction bucket sync failed"
    );
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "system_settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: {
      site_name: parsed.data.siteName,
      registration_enabled: parsed.data.registrationEnabled,
      submission_enabled: parsed.data.submissionEnabled,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/superadmin/system-settings");
  revalidatePath("/dashboard/settings");
  revalidatePublicSettings();
  return {
    status: "success",
    message: t("settingsSavedSuccess") + (bucketSyncWarning ? ` ${bucketSyncWarning}` : ""),
  };
}

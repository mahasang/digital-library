import { z } from "zod";
import type { useTranslations } from "next-intl";
import { isSafeHttpUrl } from "@/lib/utils/safe-url";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export const BIBLIOGRAPHIC_FORM_KEYS = [
  "license",
  "licenseUrl",
  "sourceUrl",
  "publisher",
  "language",
] as const;

// Mirror the CHECK constraints in migration 20260925052017.
export const LICENSE_MAX_LENGTH = 100;
export const PUBLISHER_MAX_LENGTH = 300;
export const URL_MAX_LENGTH = 2000;
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/** Language codes offered by the form's <select>. The server accepts any well-formed code. */
export const LANGUAGE_OPTIONS = ["lo", "th", "en", "vi", "fr", "zh", "ja", "ko", "de"] as const;

/** Values offered in the license <datalist>; free text is still accepted. */
export const LICENSE_SUGGESTIONS = [
  "Public Domain",
  "CC0 1.0",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "CC BY-NC-SA 4.0",
  "CC BY-ND 4.0",
  "CC BY-NC-ND 4.0",
  "CC BY 3.0 IGO",
  "CC BY-NC 3.0 IGO",
] as const;

/** Form/FormData values arrive as string | null | undefined; blank means "not provided". */
const optionalText = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional()
  );

export function createBibliographicSchema(t: TFunction) {
  const urlField = optionalText(
    z
      .string()
      .trim()
      .max(URL_MAX_LENGTH, t("bibliographic.urlTooLong"))
      .refine((v) => /^https?:\/\//i.test(v) && isSafeHttpUrl(v), t("bibliographic.urlInvalid"))
  );

  return z.object({
    license: optionalText(
      z.string().trim().max(LICENSE_MAX_LENGTH, t("bibliographic.licenseTooLong"))
    ),
    licenseUrl: urlField,
    sourceUrl: urlField,
    publisher: optionalText(
      z.string().trim().max(PUBLISHER_MAX_LENGTH, t("bibliographic.publisherTooLong"))
    ),
    language: optionalText(
      z.string().trim().regex(LANGUAGE_CODE_PATTERN, t("bibliographic.languageInvalid"))
    ),
  });
}

export type BibliographicInput = z.infer<ReturnType<typeof createBibliographicSchema>>;

/** Raw values from FormData for the five fields (missing key → undefined). */
export function readBibliographicFormData(formData: FormData) {
  return {
    license: formData.get("license") ?? undefined,
    licenseUrl: formData.get("licenseUrl") ?? undefined,
    sourceUrl: formData.get("sourceUrl") ?? undefined,
    publisher: formData.get("publisher") ?? undefined,
    language: formData.get("language") ?? undefined,
  };
}

/** True when the request carried any of the five fields at all (so an older client can't blank them). */
export function hasBibliographicFormData(formData: FormData): boolean {
  return BIBLIOGRAPHIC_FORM_KEYS.some((key) => formData.has(key));
}

/** Validated input → DB columns; omitted/blank values become NULL. */
export function toBibliographicColumns(data: BibliographicInput) {
  return {
    license: data.license ?? null,
    license_url: data.licenseUrl ?? null,
    source_url: data.sourceUrl ?? null,
    publisher: data.publisher ?? null,
    language: data.language ?? null,
  };
}

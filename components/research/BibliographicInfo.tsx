import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { isSafeHttpUrl, safeUrlHostname } from "@/lib/utils/safe-url";

interface BibliographicInfoProps {
  publisher?: string | null;
  language?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
  locale: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Language name in the page's locale; falls back to the raw code if unknown. */
function languageLabel(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Bibliographic block for externally sourced works. Renders nothing when there is nothing to show. */
export default async function BibliographicInfo(props: BibliographicInfoProps) {
  const publisher = clean(props.publisher);
  const language = clean(props.language);
  const license = clean(props.license);
  const licenseUrl = clean(props.licenseUrl);
  const sourceUrl = clean(props.sourceUrl);

  const safeLicenseUrl = isSafeHttpUrl(licenseUrl) ? licenseUrl : null;
  const safeSourceUrl = isSafeHttpUrl(sourceUrl) ? sourceUrl : null;
  const licenseText = license ?? (safeLicenseUrl ? safeUrlHostname(safeLicenseUrl) : null);
  const sourceHost = safeUrlHostname(safeSourceUrl);

  if (!publisher && !language && !licenseText && !safeSourceUrl) return null;

  const t = await getTranslations("research.detail.bibliographic");

  const linkClass =
    "inline-flex items-center gap-1 font-medium text-accent-ink underline underline-offset-2 hover:no-underline";

  const newTabNote = <span className="sr-only"> ({t("opensInNewTab")})</span>;

  return (
    <section
      aria-labelledby="bibliographic-heading"
      className="rounded-xl border border-gray-200 bg-surface p-4"
    >
      <h2
        id="bibliographic-heading"
        className="text-xs font-semibold uppercase tracking-wide text-ink-soft"
      >
        {t("title")}
      </h2>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {publisher && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="text-ink-soft sm:w-28 sm:shrink-0">{t("publisher")}</dt>
            <dd className="text-ink">{publisher}</dd>
          </div>
        )}
        {language && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="text-ink-soft sm:w-28 sm:shrink-0">{t("language")}</dt>
            <dd className="text-ink">{languageLabel(language, props.locale)}</dd>
          </div>
        )}
        {licenseText && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="text-ink-soft sm:w-28 sm:shrink-0">{t("license")}</dt>
            <dd className="text-ink">
              {safeLicenseUrl ? (
                <a
                  href={safeLicenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {licenseText}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {newTabNote}
                </a>
              ) : (
                licenseText
              )}
            </dd>
          </div>
        )}
        {safeSourceUrl && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="text-ink-soft sm:w-28 sm:shrink-0">{t("source")}</dt>
            <dd className="text-ink">
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {t("viewSource")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {newTabNote}
              </a>
              {sourceHost && <span className="ml-2 text-ink-soft">{sourceHost}</span>}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  th: "ไทย",
  en: "EN",
  lo: "ລາວ",
};

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (newLocale: string) => {
    const query = Object.fromEntries(searchParams.entries());
    router.replace({ pathname, query }, { locale: newLocale });
  };

  return (
    <div role="navigation" aria-label={t("languageLabel")} className="flex items-center gap-0.5">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleChange(loc)}
          aria-current={loc === locale ? "true" : undefined}
          lang={loc}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            loc === locale
              ? "bg-brand-600 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}

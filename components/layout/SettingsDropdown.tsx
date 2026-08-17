"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  th: "ไทย",
  en: "EN",
  lo: "ລາວ",
  vi: "VI",
};

const LOCALE_FLAGS: Record<string, string> = {
  th: "🇹🇭",
  en: "🇬🇧",
  lo: "🇱🇦",
  vi: "🇻🇳",
};

const THEME_OPTIONS = [
  { value: "light", labelKey: "themeLight", icon: Sun },
  { value: "system", labelKey: "themeSystem", icon: Monitor },
  { value: "dark", labelKey: "themeDark", icon: Moon },
] as const;

/**
 * รวม LanguageSwitcher + ThemeToggle เข้าเป็น dropdown เดียว (pill trigger
 * แบบ A) — LanguageSwitcher.tsx/ThemeToggle.tsx เดิมยังคงอยู่ตามคำสั่งของ
 * prompt (ห้ามลบ) แต่ไม่มีจุดใช้งานอื่นเหลือแล้วหลัง Header.tsx เปลี่ยนมาใช้
 * component นี้แทน
 */
export function SettingsDropdown() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ปิด dropdown เมื่อกด Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    const query = Object.fromEntries(searchParams.entries());
    router.replace({ pathname, query }, { locale: newLocale });
    setOpen(false);
  };

  const activeThemeOption = mounted
    ? (THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[1])
    : THEME_OPTIONS[1];

  const ThemeIcon = activeThemeOption.icon;

  return (
    <div ref={ref} className="relative">
      {/* Pill trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("settingsLabel")}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
      >
        {/* dot สีน้ำเงินแสดงว่า locale active */}
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
        <span className="font-medium text-gray-700">{LOCALE_LABELS[locale]}</span>
        <span className="mx-0.5 h-3 w-px bg-gray-200" aria-hidden="true" />
        <ThemeIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <svg
          className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t("settingsLabel")}
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-lg"
        >
          {/* ── ส่วนภาษา ── */}
          <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {t("languageLabel")}
          </div>
          {routing.locales.map((loc) => (
            <button
              key={loc}
              type="button"
              lang={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                loc === locale
                  ? "bg-accent-soft text-accent-ink"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {LOCALE_FLAGS[loc]}
              </span>
              <span className="flex-1 text-left">{t(loc)}</span>
              {loc === locale && (
                <svg
                  className="h-4 w-4 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {/* divider */}
          <div className="my-1 border-t border-gray-100" />

          {/* ── ส่วน theme ── */}
          <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {t("themeLabel")}
          </div>
          <div className="grid grid-cols-3 gap-1 px-3 pb-3">
            {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={mounted && theme === value}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                  mounted && theme === value
                    ? "border-brand-200 bg-accent-soft text-accent-ink"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

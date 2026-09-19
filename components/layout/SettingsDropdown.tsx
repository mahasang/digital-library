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
      {/* Pill trigger — เพิ่ม glow เมื่อ open (งาน 6) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("settingsLabel")}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200 ${
          open
            ? "border-accent/50 bg-accent-soft text-accent-ink shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
            : "border-gray-200 bg-surface text-gray-700 hover:border-gray-300 dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20"
        }`}
      >
        {/* dot สีน้ำเงินแสดงว่า locale active */}
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
        <span className="font-medium">{LOCALE_LABELS[locale]}</span>
        <span className="mx-0.5 h-3 w-px bg-gray-200 dark:bg-white/10" aria-hidden="true" />
        <ThemeIcon className="h-3.5 w-3.5" aria-hidden="true" />
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

      {/* Dropdown panel — always-mounted (ไม่ใช่ {open && ...}) เพื่อให้
       * CSS transition เล่นได้ทั้งตอนเปิดและปิด (งาน 1) + glassmorphism
       * (งาน 2) — `inert` ตอนปิดกันไม่ให้ Tab เข้าไปโฟกัสปุ่มที่มองไม่เห็น
       * ได้ (ผลข้างเคียงของการเปลี่ยนจาก conditional render เป็น
       * always-mounted ที่ prompt ไม่ได้พูดถึง แต่จำเป็นเพื่อไม่ให้เกิด
       * keyboard trap) */}
      <div
        role="dialog"
        aria-label={t("settingsLabel")}
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        className={[
          "absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl",
          "border border-white/20 backdrop-blur-xl",
          "bg-white/80 dark:bg-[#0F1117]/85 dark:border-[#3730A3]/40",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          "origin-top-right transition-all duration-200 ease-out",
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
        ].join(" ")}
      >
        {/* ── ส่วนภาษา ── */}
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {t("languageLabel")}
        </div>
        {routing.locales.map((loc) => {
          const isActive = loc === locale;
          return (
            <button
              key={loc}
              type="button"
              lang={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-l-2 border-accent bg-accent-soft font-medium text-accent-ink"
                  : "border-l-2 border-transparent text-gray-700 hover:bg-gray-50/80 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {LOCALE_FLAGS[loc]}
              </span>
              <span className="flex-1 text-left">{t(loc)}</span>
              {isActive && (
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
          );
        })}

        {/* divider — เส้นไล่เฉด (งาน 5) */}
        <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-white/10" />

        {/* ── ส่วน theme ── */}
        <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {t("themeLabel")}
        </div>
        <div className="grid grid-cols-3 gap-1 px-3 pb-3">
          {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => {
            const isActive = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={isActive}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-all ${
                  isActive
                    ? "bg-accent-soft text-accent-ink shadow-[0_0_8px_rgba(99,102,241,0.2)] ring-1 ring-accent/50 dark:shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                    : "text-gray-500 hover:bg-gray-50/80 dark:text-gray-400 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

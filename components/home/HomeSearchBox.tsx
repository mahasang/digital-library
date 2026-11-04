"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

/**
 * Hallmark — หน้าแรก H1: ช่องค้นหาแถวเดียวทุกขนาดจอ (เดิมบนมือถือแยกเป็น 2 แถว
 * ทำให้ Hero สูงขึ้นโดยไม่จำเป็น)
 * - ตัวอักษรใน input เป็น text-base (16px) เพื่อไม่ให้ iOS Safari ซูมหน้าเองตอน
 *   แตะช่องค้นหา (ต่ำกว่า 16px จะซูม)
 * - กรอบ focus อยู่ที่ <form> ทั้งก้อน และกำหนดซ้ำด้วย dark: เพราะ ring สีขาวจาง
 *   ของโหมดมืดจะทับสี focus ถ้าไม่ระบุ (variant dark มาหลัง focus-within)
 * - ข้อความ placeholder เล็กลงบนมือถือเพื่อให้แสดงครบ ไม่กระทบกฎ 16px ข้างบน
 *   เพราะ iOS Safari ดูขนาดตัวอักษรของ input ไม่ใช่ placeholder
 * - hover ของปุ่มใช้ brightness-90 ไม่ผูกกับ token สีเฉพาะ จึงอ่านออกทั้งสองโหมด
 */
export default function HomeSearchBox() {
  const t = useTranslations("home");
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/research${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-1 rounded-xl bg-surface p-1.5 shadow-elevated-md ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-focus-ring dark:ring-white/10 dark:focus-within:ring-focus-ring"
    >
      <Search className="ml-3 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        autoComplete="off"
        enterKeyHint="search"
        className="min-w-0 flex-1 border-0 bg-transparent px-2 py-3 text-base text-gray-900 placeholder:text-sm placeholder:text-gray-500 placeholder:text-ellipsis sm:placeholder:text-base focus:outline-none focus:ring-0"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-[filter] hover:brightness-90"
      >
        {t("searchButton")}
      </button>
    </form>
  );
}

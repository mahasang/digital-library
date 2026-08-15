"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

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
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 rounded-xl bg-surface p-2 shadow-elevated-md ring-1 ring-black/5 sm:flex-row"
    >
      <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5">
        <Search className="h-5 w-5 shrink-0 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        {t("searchButton")}
      </button>
    </form>
  );
}

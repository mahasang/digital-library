"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Trash2, Loader2 } from "lucide-react";
import AccountResearchRow from "@/components/account/AccountResearchRow";
import {
  clearReadingHistoryAction,
  type ReadingHistoryEntry,
} from "@/app/[locale]/account/actions";

export default function ReadingHistorySection({
  initialHistory,
}: {
  initialHistory: ReadingHistoryEntry[];
}) {
  const t = useTranslations("account");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClearAll() {
    if (!confirm(t("clearAllConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const result = await clearReadingHistoryAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (initialHistory.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-surface py-12 text-center">
        <Clock className="h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">{t("emptyHistoryTitle")}</p>
        <p className="text-xs text-gray-400">{t("emptyHistoryDescription")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t("readingHistoryCount", { count: initialHistory.length })}
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {isPending ? t("clearingAll") : t("clearAll")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-3">
        {initialHistory.map((entry) => (
          <AccountResearchRow key={entry.id} item={entry.research} readAt={entry.readAt} />
        ))}
      </div>
    </div>
  );
}

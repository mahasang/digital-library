import { DatabaseZap } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function SupabaseNotConfiguredNotice() {
  const t = await getTranslations("supabaseNotice");
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <DatabaseZap className="h-8 w-8 text-amber-600" />
      <p className="text-sm font-semibold text-amber-800">{t("title")}</p>
      <p className="text-xs leading-relaxed text-amber-700">
        {t.rich("description", {
          url: (chunks) => (
            <code className="rounded bg-amber-100 px-1 py-0.5">{chunks}</code>
          ),
          key: (chunks) => (
            <code className="rounded bg-amber-100 px-1 py-0.5">{chunks}</code>
          ),
          env: (chunks) => (
            <code className="rounded bg-amber-100 px-1 py-0.5">{chunks}</code>
          ),
        })}
      </p>
    </div>
  );
}

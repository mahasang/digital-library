import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCategoryIcon } from "@/lib/icons";
import type { Category } from "@/types/research";

export default async function CategorySection({
  categories,
  countByCategoryId,
}: {
  categories: Category[];
  countByCategoryId: Record<string, number>;
}) {
  const t = await getTranslations("home");

  return (
    <section className="py-14 sm:py-16 bg-surface-muted border-y border-gray-200">
      <Container>
        {/* ── Header ── */}
        <div className="mb-10 flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 w-0.5 bg-brand-600 rounded-full" />
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                {t("categorySubtitle")}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl tracking-tight">
              {t("categoryHeading")}
            </h2>
          </div>
          <Link
            href="/research"
            className="hidden items-center gap-1.5 rounded-sm border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-brand-600 hover:text-brand-600 transition-colors sm:flex"
          >
            {t("viewAllResearch")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const count = countByCategoryId[category.id] ?? 0;
            return (
              <Link
                key={category.id}
                href={`/research?category=${category.id}`}
                className="group flex items-start gap-3 rounded-sm border border-gray-200 bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-sm"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-gray-200 bg-gray-50 text-gray-500 group-hover:border-brand-200 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-brand-700 transition-colors">
                    {category.nameTh}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-400 tabular-nums">
                    {count} {t("categoryCount", { count }).replace(String(count), "").trim()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
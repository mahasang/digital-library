import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Container from "@/components/ui/Container";
import ResearchGrid from "@/components/research/ResearchGrid";
import type { ResearchItem } from "@/types/research";

export default async function ResearchSection({
  title,
  description,
  icon: Icon,
  items,
  tone = "light",
  variant = "default",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: ResearchItem[];
  tone?: "light" | "muted";
  variant?: "default" | "latest" | "popular";
}) {
  const t = await getTranslations("home");

  return (
    <section className={`py-14 sm:py-16 ${tone === "muted" ? "bg-gray-50 border-y border-gray-200" : "bg-white"}`}>
      <Container>
        {/* ── Header ── */}
        <div className="mb-8 flex items-end justify-between">
          <div className="flex flex-col gap-1">
            {/* accent bar + label */}
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 w-0.5 bg-brand-600 rounded-full" />
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
                <Icon className="h-3.5 w-3.5" />
                {description}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl tracking-tight">
              {title}
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
        <ResearchGrid
          items={items}
          rankStart={variant === "popular" ? 1 : undefined}
          footerMode={variant === "latest" ? "recency" : "default"}
        />

        {/* ── Mobile see all ── */}
        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 rounded-sm border border-gray-300 px-5 py-2 text-xs font-semibold text-gray-600 hover:border-brand-600 hover:text-brand-600 transition-colors"
          >
            {t("viewAllResearch")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
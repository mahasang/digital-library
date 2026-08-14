import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Container from "@/components/ui/Container";
import ResearchExplorer from "@/components/research/ResearchExplorer";
import { getCategories } from "@/lib/data/categories.server";
import { searchResearchServer, type SearchMode } from "@/lib/data/research-search.server";
import type { AccessLevel } from "@/types/research";
import type { SortOption } from "@/lib/search";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "research" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

const VALID_MODES: SearchMode[] = ["bibliographic", "pdf", "all"];
const VALID_ACCESS_LEVELS: AccessLevel[] = [
  "public",
  "member_only",
  "staff_only",
  "read_only",
  "metadata_only",
];

export default async function ResearchListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    category?: string;
    year?: string;
    access?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const t = await getTranslations("research");
  const params = await searchParams;
  const mode: SearchMode = VALID_MODES.includes(params.mode as SearchMode)
    ? (params.mode as SearchMode)
    : "all";
  const accessLevel = VALID_ACCESS_LEVELS.includes(params.access as AccessLevel)
    ? (params.access as AccessLevel)
    : undefined;
  const sort = (params.sort as SortOption) || "newest";
  const page = Number(params.page) || 1;

  const [categories, result] = await Promise.all([
    getCategories(),
    searchResearchServer({
      query: params.q,
      mode,
      categoryId: params.category,
      year: params.year ? Number(params.year) : undefined,
      accessLevel,
      sort,
      page,
    }),
  ]);

  return (
    <section className="py-10 sm:py-12">
      <Container>
        <div className="mb-8">
          <h1 className="text-h1 font-semibold text-gray-900">
            {t("pageHeading")}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {t("pageSubtitle")}
          </p>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-500">{t("loading")}</div>}>
          <ResearchExplorer
            categories={categories}
            result={result}
            query={params.q ?? ""}
            mode={mode}
            categoryId={params.category ?? "all"}
            year={params.year ?? "all"}
            accessLevel={params.access ?? "all"}
            sort={sort}
          />
        </Suspense>
      </Container>
    </section>
  );
}

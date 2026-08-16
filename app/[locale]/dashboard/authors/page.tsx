import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { searchAuthorsForAdmin } from "@/lib/data/authors-admin.server";
import AuthorCreateForm from "@/components/dashboard/AuthorCreateForm";
import { getOrganizations } from "@/lib/data/organizations.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("authors.pageTitle") };
}

export default async function DashboardAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string; orcid?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/authors", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const t = await getTranslations("dashboard");
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [{ items, total, totalPages }, organizations] = await Promise.all([
    searchAuthorsForAdmin({
      query: params.q,
      isActive: params.active === "true" ? true : params.active === "false" ? false : undefined,
      hasOrcid: params.orcid === "true" ? true : params.orcid === "false" ? false : undefined,
      page,
    }),
    getOrganizations(),
  ]);

  function buildPageUrl(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.active) sp.set("active", params.active);
    if (params.orcid) sp.set("orcid", params.orcid);
    sp.set("page", String(targetPage));
    return `/dashboard/authors?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("authors.heading")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("authors.subtitle", { total })}
          </p>
        </div>
      </div>

      <AuthorCreateForm organizations={organizations} />

      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:min-w-[200px]">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder={t("authors.searchPlaceholder")}
            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
          />
        </div>
        <select
          name="active"
          defaultValue={params.active ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">{t("authors.allStatuses")}</option>
          <option value="true">{t("authors.enabled")}</option>
          <option value="false">{t("authors.disabled")}</option>
        </select>
        <select
          name="orcid"
          defaultValue={params.orcid ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">{t("authors.hasOrcidAny")}</option>
          <option value="true">{t("authors.hasOrcid")}</option>
          <option value="false">{t("authors.noOrcid")}</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t("authors.search")}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("authors.colName")}</th>
              <th className="px-4 py-3">{t("authors.colOrganization")}</th>
              <th className="px-4 py-3">{t("authors.colOrcid")}</th>
              <th className="px-4 py-3">{t("authors.colResearch")}</th>
              <th className="px-4 py-3">{t("authors.colStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  {t("authors.noResults")}
                </td>
              </tr>
            ) : (
              items.map((author) => (
                <tr key={author.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/authors/${author.id}`} className="font-medium text-accent hover:underline">
                      {author.name}
                    </Link>
                    {author.displayNameEn && <p className="text-xs text-gray-500">{author.displayNameEn}</p>}
                    {author.mergedIntoAuthorId && (
                      <Badge tone="gray" className="mt-1">
                        {t("authors.merged")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{author.organizationNameTh ?? "-"}</td>
                  <td className="px-4 py-3">
                    {author.orcid ? (
                      <span className="flex items-center gap-1 font-mono text-xs text-gray-700">
                        {author.orcidVerifiedAt && <ShieldCheck className="h-3.5 w-3.5 text-green-600" />}
                        {author.orcid}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{author.researchCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={author.isActive ? "green" : "gray"}>
                      {author.isActive ? t("authors.enabled") : t("authors.disabled")}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildPageUrl(Math.max(1, page - 1))}
            className={`rounded-lg border border-gray-200 p-2 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-gray-500">
            {t("authors.pageOf", { page, totalPages })}
          </span>
          <Link
            href={buildPageUrl(Math.min(totalPages, page + 1))}
            className={`rounded-lg border border-gray-200 p-2 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

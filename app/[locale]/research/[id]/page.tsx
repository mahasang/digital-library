import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import {
  BookOpenText,
  Calendar,
  Download,
  Eye,
  Files,
  Tag,
  Users,
} from "lucide-react";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import AccessBadge from "@/components/research/AccessBadge";
import CategoryCover from "@/components/research/CategoryCover";
import DownloadButton from "@/components/research/DownloadButton";
import FavoriteButton from "@/components/research/FavoriteButton";
import CitationButton from "@/components/research/CitationButton";
import ShareButton from "@/components/research/ShareButton";
import ResearchGrid from "@/components/research/ResearchGrid";
import { hasRealCoverImage } from "@/lib/categoryCover";
import {
  getResearchById,
  getRelatedResearch,
  getMergedRedirectSlug,
} from "@/lib/data/research.server";
import { getCategoryById } from "@/lib/data/categories.server";
import { canDownload, canReadOnline } from "@/lib/labels";
import { getSessionUser } from "@/lib/supabase/session";
import { isResearchFavorited } from "@/lib/data/favorites.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyActiveGrantsBySlug } from "@/lib/data/access-grants.server";
import { getMyLatestRequestForItem } from "@/lib/data/access-requests.server";
import AccessRequestButton from "@/components/research/AccessRequestButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const item = await getResearchById(id);
  if (!item) {
    const t = await getTranslations({ locale, namespace: "research.detail" });
    return { title: t("notFoundTitle") };
  }
  return {
    title: item.titleTh,
    description: item.abstract.slice(0, 150),
  };
}

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const item = await getResearchById(id);
  if (!item || item.status !== "published") {
    // งานวิจัยนี้อาจถูกรวม (merge) เข้ากับรายการอื่นไปแล้ว — redirect ไปยัง
    // รายการหลักแทนการแสดง 404 เฉยๆ ถ้าเป็นกรณีนี้จริง
    const redirectSlug = await getMergedRedirectSlug(id);
    if (redirectSlug) return redirect({ href: `/research/${redirectSlug}`, locale });
    notFound();
  }

  // category/related ขึ้นกับ item เท่านั้น ส่วน user (session) ไม่ขึ้นกับ item
  // เลย — ทั้งสามไม่พึ่งผลของกันและกัน จึงยิงพร้อมกันได้ (Phase 3 — parallel
  // data fetching)
  const [category, related, user] = await Promise.all([
    getCategoryById(item.categoryId),
    getRelatedResearch(item),
    getSessionUser(),
  ]);

  // grants = สิทธิ์เสริมจากระบบขอสิทธิ์เข้าถึงเอกสาร (ช่วงที่ 18) — OR เข้ากับ
  // canReadOnline/canDownload(access_level) เดิมเสมอ ไม่เคยแทนที่ค่าเดิม เอกสาร
  // public ที่ทุกคนอ่าน/ดาวน์โหลดได้อยู่แล้วจึงไม่มีวันแสดงปุ่มขอสิทธิ์เพิ่ม
  //
  // initialFavorited และ grants ต่างก็ขึ้นกับ user + item.id เท่านั้น ไม่ขึ้นกับ
  // กันเอง จึงยิงพร้อมกันได้เช่นกัน (เงื่อนไข guard ของแต่ละตัวยังคงเดิมทุก
  // ประการ — initialFavorited เช็คแค่ user, grants เช็ค isSupabaseConfigured()
  // && user เหมือนโค้ดเดิม)
  const [initialFavorited, grants] = await Promise.all([
    user ? isResearchFavorited(user.id, item.id) : Promise.resolve(false),
    isSupabaseConfigured() && user
      ? getMyActiveGrantsBySlug(item.id)
      : Promise.resolve({ read: false, download: false }),
  ]);
  const readable = canReadOnline(item.accessLevel) || grants.read;
  const downloadable = canDownload(item.accessLevel) || grants.download;

  const [latestReadRequest, latestDownloadRequest] =
    isSupabaseConfigured() && user
      ? await Promise.all([
          !readable ? getMyLatestRequestForItem(item.id, "read") : Promise.resolve(null),
          !downloadable ? getMyLatestRequestForItem(item.id, "download") : Promise.resolve(null),
        ])
      : [null, null];

  const t = await getTranslations("research.detail");
  const tAccessDescriptions = await getTranslations("accessLevels.descriptions");
  const dateLocale = locale === "en" ? "en-US" : "th-TH";

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <nav aria-label={t("breadcrumbLabel")} className="mb-6 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          <Link href="/" className="hover:text-accent">
            {t("breadcrumbHome")}
          </Link>
          <span>/</span>
          <Link href="/research" className="hover:text-accent">
            {t("breadcrumbResearch")}
          </Link>
          {category && (
            <>
              <span>/</span>
              <Link
                href={`/research?category=${category.id}`}
                className="hover:text-accent"
              >
                {category.nameTh}
              </Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="relative aspect-[4/5.6] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-elevated-sm">
              {hasRealCoverImage(item.coverImage) ? (
                <Image
                  src={item.coverImage}
                  alt={t("coverAlt", { title: item.titleTh })}
                  fill
                  sizes="(max-width: 1024px) 60vw, 280px"
                  className="object-cover"
                  priority
                />
              ) : (
                <CategoryCover category={category} iconClassName="h-14 w-14" />
              )}
            </div>

            {/* Action หลัก: อ่านออนไลน์ หรือขอสิทธิ์อ่าน (ถ้ายังไม่มีสิทธิ์) */}
            {readable ? (
              <LinkButton href={`/research/${item.id}/read`} variant="primary" size="lg" className="w-full">
                <BookOpenText className="h-4 w-4" />
                {t("readOnline")}
              </LinkButton>
            ) : (
              <AccessRequestButton
                researchSlug={item.id}
                requestType="read"
                isLoggedIn={Boolean(user)}
                latestStatus={latestReadRequest?.status ?? null}
                variant="primary"
              />
            )}

            {/* Action รอง: ดาวน์โหลด หรือขอสิทธิ์ดาวน์โหลด (ถ้ายังไม่มีสิทธิ์) */}
            {downloadable ? (
              <DownloadButton
                accessLevel={item.accessLevel}
                pdfFile={item.pdfFile}
                fileName={`${item.id}.pdf`}
                researchSlug={item.id}
                hasDownloadGrant={grants.download}
              />
            ) : (
              <AccessRequestButton
                researchSlug={item.id}
                requestType="download"
                isLoggedIn={Boolean(user)}
                latestStatus={latestDownloadRequest?.status ?? null}
              />
            )}

            {/* Action รองลงไปอีก (tertiary): รายการโปรด / อ้างอิง / แชร์ —
                ทั้งสามอย่างนี้ไม่ผูกกับสิทธิ์การเข้าถึงเอกสาร จึงแสดงเสมอ */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <FavoriteButton
                researchSlug={item.id}
                initialFavorited={initialFavorited}
                isLoggedIn={Boolean(user)}
                variant="compact"
              />
              <CitationButton item={item} />
              <ShareButton title={item.titleTh} />
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-surface p-4 text-xs">
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Eye className="h-3.5 w-3.5" /> {t("statViews")}
                </dt>
                <dd className="font-semibold text-gray-900">
                  {item.views.toLocaleString(dateLocale)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Download className="h-3.5 w-3.5" /> {t("statDownloads")}
                </dt>
                <dd className="font-semibold text-gray-900">
                  {item.downloads.toLocaleString(dateLocale)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Files className="h-3.5 w-3.5" /> {t("statPages")}
                </dt>
                <dd className="font-semibold text-gray-900">{item.pageCount} {t("pagesUnit")}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Calendar className="h-3.5 w-3.5" /> {t("statYear")}
                </dt>
                <dd className="font-semibold text-gray-900">{item.year}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {category && <Badge tone="brand">{category.nameTh}</Badge>}
                <AccessBadge accessLevel={item.accessLevel} />
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("yearLabel", { year: item.year })}
                </span>
              </div>
              <h1 className="text-h1 font-semibold leading-snug text-gray-900">
                {item.titleTh}
              </h1>
              <p className="mt-1.5 text-sm italic text-gray-500">{item.titleEn}</p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-surface p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Users className="h-4 w-4 text-accent" />
                {t("researchersTitle")}
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {item.researchers.map((r) => (
                  <li key={r.name} className="text-sm text-gray-700">
                    {r.authorId ? (
                      <Link
                        href={`/authors/${r.authorId}`}
                        className="font-medium text-accent-ink hover:underline"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span>{r.name}</span>
                    )}
                    {r.organization && (
                      <span className="text-gray-500"> — {r.organization}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                {item.organization}
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("abstractTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                {item.abstract}
              </p>
            </div>

            <div>
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Tag className="h-4 w-4 text-accent" />
                {t("keywordsTitle")}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.keywords.map((kw) => (
                  <Link
                    key={kw}
                    href={`/research?q=${encodeURIComponent(kw)}`}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  >
                    #{kw}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-accent-soft p-4 text-sm text-accent-ink">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
                {t("accessTitle")}
              </p>
              <p className="mt-1.5 text-accent-ink">
                {tAccessDescriptions(item.accessLevel)}
              </p>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-14 border-t border-gray-100 pt-10">
            <h2 className="mb-4 text-h2 font-semibold text-gray-900">
              {t("relatedTitle")}
            </h2>
            <ResearchGrid items={related} />
          </div>
        )}
      </Container>
    </section>
  );
}

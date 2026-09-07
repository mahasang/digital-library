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
import RatingSection from "@/components/research/RatingSection";
import CommentSection from "@/components/research/CommentSection";
import {
  getRatingStatsAction,
  getMyRatingAction,
  getCommentsAction,
} from "./actions";

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
  // data fetching) ratingStats/myRating/comments ก็เช่นกัน ขึ้นกับ item.id
  // เท่านั้น (getMyRatingAction ดึง user เองภายในฟังก์ชัน ไม่ต้องรอ user
  // ตัวแปรนี้ก่อน) จึงยิงรวมชุดเดียวกันได้เลย
  const [category, related, user, ratingStats, myRating, comments] = await Promise.all([
    getCategoryById(item.categoryId),
    getRelatedResearch(item),
    getSessionUser(),
    getRatingStatsAction(item.id),
    getMyRatingAction(item.id),
    getCommentsAction(item.id),
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
    <section className="py-8 sm:py-12 bg-surface-muted min-h-screen">
      <Container>
        {/* ── Breadcrumb ── */}
        <nav aria-label={t("breadcrumbLabel")} className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-brand-600 transition-colors">{t("breadcrumbHome")}</Link>
          <span>/</span>
          <Link href="/research" className="hover:text-brand-600 transition-colors">{t("breadcrumbResearch")}</Link>
          {category && (
            <>
              <span>/</span>
              <Link href={`/research?category=${category.id}`} className="hover:text-brand-600 transition-colors">
                {category.nameTh}
              </Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">

          {/* ── Left sidebar ── */}
          <div className="flex flex-col gap-4">
            {/* Cover */}
            <div className="relative aspect-[4/5.6] w-full overflow-hidden rounded-sm border border-gray-200 bg-gray-100 shadow-sm">
              {hasRealCoverImage(item.coverImage) ? (
                <Image
                  src={item.coverImage}
                  alt={t("coverAlt", { title: item.titleTh })}
                  fill
                  sizes="(max-width: 1024px) 60vw, 260px"
                  className="object-cover"
                  priority
                />
              ) : (
                <CategoryCover category={category} iconClassName="h-14 w-14" />
              )}
            </div>

            {/* Actions */}
            {readable ? (
              <LinkButton href={`/research/${item.id}/read`} variant="primary" size="lg" className="w-full rounded-sm">
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

            {/* Tertiary actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
              <FavoriteButton researchSlug={item.id} initialFavorited={initialFavorited} isLoggedIn={Boolean(user)} variant="compact" />
              <CitationButton item={item} />
              <ShareButton title={item.titleTh} />
            </div>

            {/* Stats */}
            <dl className="grid grid-cols-2 gap-px rounded-sm border border-gray-200 bg-gray-200 overflow-hidden text-xs">
              {[
                { icon: Eye,      label: t("statViews"),     value: item.views.toLocaleString(dateLocale) },
                { icon: Download, label: t("statDownloads"), value: item.downloads.toLocaleString(dateLocale) },
                { icon: Files,    label: t("statPages"),     value: `${item.pageCount} ${t("pagesUnit")}` },
                { icon: Calendar, label: t("statYear"),      value: item.year },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col gap-1 bg-surface p-3">
                  <dt className="flex items-center gap-1 text-gray-400">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </dt>
                  <dd className="font-bold text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ── Main content ── */}
          <div className="flex flex-col gap-6">
            {/* Title block */}
            <div className="border-b border-gray-200 pb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {category && (
                  <span className="rounded-sm bg-brand-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                    {category.nameTh}
                  </span>
                )}
                <AccessBadge accessLevel={item.accessLevel} />
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("yearLabel", { year: item.year })}
                </span>
              </div>
              <h1 className="text-2xl font-bold leading-snug text-ink sm:text-3xl tracking-tight">
                {item.titleTh}
              </h1>
              {item.titleEn && (
                <p className="mt-2 text-sm italic text-gray-400 leading-relaxed">{item.titleEn}</p>
              )}
            </div>

            {/* Researchers */}
            <div className="rounded-sm border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-4 w-0.5 bg-brand-600 rounded-full" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  {t("researchersTitle")}
                </h2>
              </div>
              <ul className="flex flex-col gap-2">
                {item.researchers.map((r) => (
                  <li key={r.name} className="flex items-start gap-2 text-sm">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                    <span>
                      {r.authorId ? (
                        <Link href={`/authors/${r.authorId}`} className="font-semibold text-brand-700 hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-800">{r.name}</span>
                      )}
                      {r.organization && (
                        <span className="text-gray-400 italic"> — {r.organization}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {item.organization && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                  {item.organization}
                </p>
              )}
            </div>

            {/* Abstract */}
            <div className="rounded-sm border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-4 w-0.5 bg-brand-600 rounded-full" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  {t("abstractTitle")}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-gray-700">{item.abstract}</p>
            </div>

            {/* Keywords */}
            {item.keywords.length > 0 && (
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-4 w-0.5 bg-brand-600 rounded-full" />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    {t("keywordsTitle")}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.keywords.map((kw) => (
                    <Link
                      key={kw}
                      href={`/research?q=${encodeURIComponent(kw)}`}
                      className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      #{kw}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Access level */}
            <div className="rounded-sm border-l-4 border-brand-600 bg-brand-50 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 mb-1">
                {t("accessTitle")}
              </p>
              <p className="text-brand-800">{tAccessDescriptions(item.accessLevel)}</p>
            </div>
          </div>
        </div>

        {/* ── Rating + Comments ── */}
        <div className="mt-10 flex flex-col gap-6">
          <RatingSection
            researchId={item.id}
            avgScore={ratingStats.avgScore}
            ratingCount={ratingStats.ratingCount}
            myRating={myRating}
            isLoggedIn={!!user}
          />
          <CommentSection
            researchId={item.id}
            initialComments={comments}
            isLoggedIn={!!user}
          />
        </div>
        </Container>
        </section>
  );
}

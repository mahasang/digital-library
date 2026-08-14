import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
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
import { accessLevelDescriptions, canDownload, canReadOnline } from "@/lib/labels";
import { getSessionUser } from "@/lib/supabase/session";
import { isResearchFavorited } from "@/lib/data/favorites.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyActiveGrantsBySlug } from "@/lib/data/access-grants.server";
import { getMyLatestRequestForItem } from "@/lib/data/access-requests.server";
import AccessRequestButton from "@/components/research/AccessRequestButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getResearchById(id);
  if (!item) return { title: "ไม่พบงานวิจัย" };
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
  const item = await getResearchById(id);
  if (!item || item.status !== "published") {
    // งานวิจัยนี้อาจถูกรวม (merge) เข้ากับรายการอื่นไปแล้ว — redirect ไปยัง
    // รายการหลักแทนการแสดง 404 เฉยๆ ถ้าเป็นกรณีนี้จริง
    const redirectSlug = await getMergedRedirectSlug(id);
    if (redirectSlug) redirect(`/research/${redirectSlug}`);
    notFound();
  }

  const category = await getCategoryById(item.categoryId);
  const related = await getRelatedResearch(item);

  const user = await getSessionUser();
  const initialFavorited = user ? await isResearchFavorited(user.id, item.id) : false;

  // grants = สิทธิ์เสริมจากระบบขอสิทธิ์เข้าถึงเอกสาร (ช่วงที่ 18) — OR เข้ากับ
  // canReadOnline/canDownload(access_level) เดิมเสมอ ไม่เคยแทนที่ค่าเดิม เอกสาร
  // public ที่ทุกคนอ่าน/ดาวน์โหลดได้อยู่แล้วจึงไม่มีวันแสดงปุ่มขอสิทธิ์เพิ่ม
  const grants =
    isSupabaseConfigured() && user
      ? await getMyActiveGrantsBySlug(item.id)
      : { read: false, download: false };
  const readable = canReadOnline(item.accessLevel) || grants.read;
  const downloadable = canDownload(item.accessLevel) || grants.download;

  const [latestReadRequest, latestDownloadRequest] =
    isSupabaseConfigured() && user
      ? await Promise.all([
          !readable ? getMyLatestRequestForItem(item.id, "read") : Promise.resolve(null),
          !downloadable ? getMyLatestRequestForItem(item.id, "download") : Promise.resolve(null),
        ])
      : [null, null];

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <nav aria-label="เส้นทางการนำทาง" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          <Link href="/" className="hover:text-accent">
            หน้าแรก
          </Link>
          <span>/</span>
          <Link href="/research" className="hover:text-accent">
            งานวิจัย
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
                  alt={`ปกงานวิจัย: ${item.titleTh}`}
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
                อ่านออนไลน์
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
                  <Eye className="h-3.5 w-3.5" /> เข้าชม
                </dt>
                <dd className="font-semibold text-gray-900">
                  {item.views.toLocaleString("th-TH")}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
                </dt>
                <dd className="font-semibold text-gray-900">
                  {item.downloads.toLocaleString("th-TH")}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Files className="h-3.5 w-3.5" /> จำนวนหน้า
                </dt>
                <dd className="font-semibold text-gray-900">{item.pageCount} หน้า</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Calendar className="h-3.5 w-3.5" /> ปีที่เผยแพร่
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
                  ปี {item.year}
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
                ผู้วิจัย
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {item.researchers.map((r) => (
                  <li key={r.name} className="text-sm text-gray-700">
                    {r.name}
                    <span className="text-gray-500"> — {r.organization}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                {item.organization}
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                บทคัดย่อ
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                {item.abstract}
              </p>
            </div>

            <div>
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Tag className="h-4 w-4 text-accent" />
                คำสำคัญ
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
                สิทธิ์การเข้าถึงเอกสารนี้
              </p>
              <p className="mt-1.5 text-accent-ink">
                {accessLevelDescriptions[item.accessLevel]}
              </p>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-14 border-t border-gray-100 pt-10">
            <h2 className="mb-4 text-h2 font-semibold text-gray-900">
              งานวิจัยที่เกี่ยวข้อง
            </h2>
            <ResearchGrid items={related} />
          </div>
        )}
      </Container>
    </section>
  );
}

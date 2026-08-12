import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import AccessBadge from "@/components/research/AccessBadge";
import StatusBadge from "@/components/research/StatusBadge";
import DuplicateReviewActionsPanel from "@/components/dashboard/DuplicateReviewActionsPanel";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getDuplicateReviewDetail } from "@/lib/data/duplicate-research.server";
import { getSubmissionById } from "@/lib/data/submissions.server";
import type { SubmissionItem } from "@/types/research";

export const metadata: Metadata = { title: "เปรียบเทียบงานวิจัยที่อาจซ้ำ" };

export default async function DuplicateReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/dashboard/duplicate-reviews/${id}`);

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const review = await getDuplicateReviewDetail(id);
  if (!review) notFound();

  const [researchItem, candidateItem] = await Promise.all([
    getSubmissionById(review.researchItemId),
    getSubmissionById(review.candidateResearchItemId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/duplicate-reviews"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายการตรวจสอบงานวิจัยซ้ำ
      </Link>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">
          คล้ายกัน {Math.round(review.similarityScore * 100)}%
        </p>
        <p className="mt-1 text-xs text-amber-700">{review.similarityReasons.join(" · ")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ResearchCompareCard item={researchItem} />
        <ResearchCompareCard item={candidateItem} />
      </div>

      <DuplicateReviewActionsPanel
        reviewId={review.id}
        researchItemId={review.researchItemId}
        researchTitle={review.researchTitleTh}
        candidateResearchItemId={review.candidateResearchItemId}
        candidateTitle={review.candidateTitleTh}
        canMerge={rank >= 40}
      />
    </div>
  );
}

function ResearchCompareCard({ item }: { item: SubmissionItem | undefined }) {
  if (!item) {
    return (
      <div className="rounded-xl border border-gray-200 bg-surface p-5 text-sm text-gray-500">
        ไม่พบข้อมูลงานวิจัยนี้ (อาจถูกรวมหรือลบไปแล้ว)
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} />
        <AccessBadge accessLevel={item.accessLevel} />
      </div>
      <Link
        href={`/dashboard/research/${item.id}/edit`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        {item.titleTh}
      </Link>
      {item.titleEn && <p className="text-xs italic text-gray-500">{item.titleEn}</p>}

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {item.year}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {item.researchers.map((r) => r.name).join(", ") || "ไม่ระบุผู้วิจัย"}
        </span>
      </div>

      <p className="line-clamp-4 text-sm text-gray-600">{item.abstract}</p>

      <div className="flex flex-wrap gap-1.5">
        {item.keywords.map((kw) => (
          <Badge key={kw} tone="gray">
            {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}

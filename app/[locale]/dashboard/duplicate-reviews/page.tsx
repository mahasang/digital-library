import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getDuplicateReviews } from "@/lib/data/duplicate-research.server";
import type { DuplicateReviewStatusRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "ตรวจสอบงานวิจัยซ้ำ" };

const STATUS_LABELS: Record<DuplicateReviewStatusRow, string> = {
  pending: "รอตรวจสอบ",
  confirmed_duplicate: "ยืนยันว่าซ้ำ",
  not_duplicate: "ไม่ซ้ำ",
  merged: "รวมข้อมูลแล้ว",
};

const STATUS_TONE: Record<DuplicateReviewStatusRow, "brand" | "green" | "amber" | "red" | "gray" | "purple"> = {
  pending: "amber",
  confirmed_duplicate: "red",
  not_duplicate: "gray",
  merged: "green",
};

export default async function DuplicateReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ruleVersion?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/duplicate-reviews");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const params = await searchParams;
  const status = (["pending", "confirmed_duplicate", "not_duplicate", "merged"] as const).includes(
    params.status as DuplicateReviewStatusRow
  )
    ? (params.status as DuplicateReviewStatusRow)
    : undefined;
  const ruleVersion = params.ruleVersion && Number.isFinite(Number(params.ruleVersion))
    ? Number(params.ruleVersion)
    : undefined;

  const reviews = await getDuplicateReviews(status, ruleVersion);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ตรวจสอบงานวิจัยซ้ำ</h1>
        <p className="mt-1 text-sm text-gray-500">
          คู่งานวิจัยที่ระบบตรวจพบว่าอาจซ้ำกัน — ไม่มีการรวมข้อมูลอัตโนมัติ ต้องตรวจสอบและยืนยันโดยเจ้าหน้าที่เสมอ
        </p>
      </div>

      {ruleVersion && (
        <p className="rounded-lg bg-accent-soft p-3 text-xs text-accent-ink">
          กำลังกรองเฉพาะผลจากเกณฑ์เวอร์ชัน {ruleVersion} —{" "}
          <Link href={`/dashboard/duplicate-reviews${status ? `?status=${status}` : ""}`} className="underline">
            ดูทุกเวอร์ชัน
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(["pending", "confirmed_duplicate", "not_duplicate", "merged"] as const).map((s) => (
          <Link
            key={s}
            href={`/dashboard/duplicate-reviews?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              status === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
        <Link
          href="/dashboard/duplicate-reviews"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            !status ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          ทั้งหมด
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
            ไม่พบรายการตามเงื่อนไขที่เลือก
          </div>
        ) : (
          reviews.map((review) => (
            <Link
              key={review.id}
              href={`/dashboard/duplicate-reviews/${review.id}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[review.status]}>{STATUS_LABELS[review.status]}</Badge>
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  คล้ายกัน {Math.round(review.similarityScore * 100)}%
                </span>
                {review.ruleVersion !== null && <Badge tone="gray">เกณฑ์ v{review.ruleVersion}</Badge>}
                {review.staleRuleVersion && <Badge tone="amber">เกณฑ์เก่ากว่าปัจจุบัน</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="line-clamp-1 text-sm font-medium text-gray-900">{review.researchTitleTh}</p>
                <p className="line-clamp-1 text-sm font-medium text-gray-900">{review.candidateTitleTh}</p>
              </div>
              <p className="text-xs text-gray-500">{review.similarityReasons.join(" · ")}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

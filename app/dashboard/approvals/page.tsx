import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, ClipboardList, Users } from "lucide-react";
import Container from "@/components/ui/Container";
import StatusBadge from "@/components/research/StatusBadge";
import AccessBadge from "@/components/research/AccessBadge";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSubmissionsByStatus } from "@/lib/data/submissions.server";

export const metadata: Metadata = {
  title: "อนุมัติงานวิจัย",
  description: "ตรวจสอบและอนุมัติงานวิจัยที่รอการพิจารณา",
};

export default async function ApprovalsDashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/approvals");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const [pending, revisionRequested, approved] = await Promise.all([
    getSubmissionsByStatus(["pending_review"]),
    getSubmissionsByStatus(["revision_requested"]),
    getSubmissionsByStatus(["approved"]),
  ]);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">อนุมัติงานวิจัย</h1>
          <p className="mt-1 text-sm text-gray-500">
            ตรวจสอบงานวิจัยที่ส่งเข้ามา อนุมัติ ขอแก้ไข หรือปฏิเสธ พร้อมเผยแพร่งานที่อนุมัติแล้ว
          </p>
        </div>

        <ApprovalSection
          title="รอตรวจสอบ"
          description="งานวิจัยที่ส่งเข้ามาใหม่ รอการตรวจสอบครั้งแรก"
          items={pending}
        />
        <ApprovalSection
          title="ขอให้แก้ไข (รอผู้ส่งแก้ไขและส่งกลับ)"
          description="งานวิจัยที่เคยตรวจสอบแล้วและขอให้ผู้ส่งแก้ไข"
          items={revisionRequested}
        />
        <ApprovalSection
          title="อนุมัติแล้ว (รอเผยแพร่)"
          description="งานวิจัยที่ผ่านการตรวจสอบแล้ว รอดำเนินการเผยแพร่"
          items={approved}
        />
      </Container>
    </div>
  );
}

function ApprovalSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Awaited<ReturnType<typeof getSubmissionsByStatus>>;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-gray-900">
          {title} <span className="ml-1 text-sm font-normal text-gray-500">({items.length})</span>
        </h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
          ไม่มีรายการในหมวดนี้
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/approvals/${item.id}`}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">
                  {item.titleTh}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <AccessBadge accessLevel={item.accessLevel} />
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    {item.researchers.map((r) => r.name).join(", ") || "ไม่ระบุผู้วิจัย"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(item.updatedAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

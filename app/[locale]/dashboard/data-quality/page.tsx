import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertCircle, Building2, Calendar, Users } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getDataQualityReport, type DataQualityIssueItem } from "@/lib/data/data-quality.server";

export const metadata: Metadata = { title: "คุณภาพข้อมูล" };

export default async function DataQualityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/data-quality");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const report = await getDataQualityReport();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">คุณภาพข้อมูล</h1>
        <p className="mt-1 text-sm text-gray-500">
          รายการงานวิจัยที่ข้อมูลยังไม่ครบถ้วน — ช่วยให้เจ้าหน้าที่ตามแก้ไขได้ตรงจุด
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="ผู้วิจัยไม่มี ORCID" value={report.authorsMissingOrcid} icon={Users} />
        <SummaryCard label="งานวิจัยไม่มีผู้วิจัย" value={report.missingAuthors.length} icon={Users} />
        <SummaryCard label="งานวิจัยไม่มีหน่วยงาน" value={report.missingOrganization.length} icon={Building2} />
      </div>

      <IssueSection
        title="งานวิจัยที่ไม่มีผู้วิจัย"
        description="ไม่มีแถวใน research_authors ผูกอยู่เลย"
        items={report.missingAuthors}
      />
      <IssueSection
        title="งานวิจัยที่ไม่มีหน่วยงาน"
        description="ยังไม่ได้ระบุ organization_id"
        items={report.missingOrganization}
      />
      <IssueSection
        title="งานวิจัยที่เผยแพร่แล้วแต่ไม่มีวันที่เผยแพร่"
        description="สถานะเป็น published แต่ published_at ยังว่างอยู่"
        items={report.missingPublishedDate}
        icon={Calendar}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString("th-TH")}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function IssueSection({
  title,
  description,
  items,
  icon: Icon = AlertCircle,
}: {
  title: string;
  description: string;
  items: DataQualityIssueItem[];
  icon?: typeof AlertCircle;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">
          {title} <span className="ml-1 font-normal text-gray-500">({items.length})</span>
        </h2>
      </div>
      <p className="mb-3 text-xs text-gray-500">{description}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">ไม่พบรายการ</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/research/${item.id}/edit`}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <span className="line-clamp-1 text-gray-700">{item.titleTh}</span>
              <span className="shrink-0 text-xs text-gray-500">{item.status}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

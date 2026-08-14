import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import SubmitResearchForm from "@/components/submission/SubmitResearchForm";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getOrganizations } from "@/lib/data/organizations.server";
import { getCategories } from "@/lib/data/categories.server";
import { getSettings } from "@/lib/data/settings.server";
import { adminCreateResearchAction } from "@/app/[locale]/dashboard/research/new/actions";

export const metadata: Metadata = { title: "เพิ่มงานวิจัย" };

export default async function DashboardNewResearchPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/research/new");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const [organizations, categories, settings] = await Promise.all([
    getOrganizations(),
    getCategories(),
    getSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/research"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปจัดการงานวิจัย
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">เพิ่มงานวิจัย</h1>
        <p className="mt-1 text-sm text-gray-500">
          เพิ่มงานวิจัยเข้าระบบโดยตรง (เช่น นำเข้าเอกสารเก่า) สามารถเผยแพร่ทันทีได้
        </p>
      </div>

      <SubmitResearchForm
        userId={user.id}
        organizations={organizations}
        categories={categories}
        submitAction={adminCreateResearchAction}
        extraIntents={[{ value: "published", label: "เผยแพร่ทันที" }]}
        fileLimits={{
          maxPdfSizeMb: settings.maxPdfSizeMb,
          maxCoverSizeMb: settings.maxCoverSizeMb,
          maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
        }}
      />
    </div>
  );
}

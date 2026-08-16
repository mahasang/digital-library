import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import {
  getDownloadsReport,
  getMembersReport,
  getPopularReport,
  getViewsReport,
} from "@/lib/data/reports.server";
import { toCsv } from "@/lib/reports/csv";
import type { UserRole } from "@/types/research";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.reports.export" });
  const tRoles = await getTranslations({ locale, namespace: "roles" });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: t("errorNotConfigured") }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: t("errorUnauthenticated") }, { status: 401 });
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return NextResponse.json({ error: t("errorForbidden") }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "views";
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const categoryId = searchParams.get("category") ?? undefined;
  const role = (searchParams.get("role") as UserRole | null) ?? undefined;

  let csv: string;
  let filename: string;

  if (type === "downloads") {
    const rows = await getDownloadsReport({ from, to, categoryId });
    csv = toCsv(rows, [
      { key: "titleTh", label: t("colTitle") },
      { key: "slug", label: t("colSlug") },
      { key: "count", label: t("colDownloadCount") },
    ]);
    filename = "downloads-report.csv";
  } else if (type === "popular") {
    const rows = await getPopularReport({ categoryId });
    csv = toCsv(rows, [
      { key: "titleTh", label: t("colTitle") },
      { key: "slug", label: t("colSlug") },
      { key: "views", label: t("colViews") },
      { key: "downloads", label: t("colDownloads") },
    ]);
    filename = "popular-research-report.csv";
  } else if (type === "members") {
    const rows = await getMembersReport({ from, to, role });
    const mapped = rows.map((r) => ({ ...r, roleLabel: tRoles(r.role) }));
    csv = toCsv(mapped, [
      { key: "fullName", label: t("colFullName") },
      { key: "email", label: t("colEmail") },
      { key: "organizationName", label: t("colOrganization") },
      { key: "roleLabel", label: t("colRole") },
      { key: "createdAt", label: t("colJoinedDate") },
    ]);
    filename = "members-report.csv";
  } else {
    const rows = await getViewsReport({ from, to, categoryId });
    csv = toCsv(rows, [
      { key: "titleTh", label: t("colTitle") },
      { key: "slug", label: t("colSlug") },
      { key: "count", label: t("colViewCount") },
    ]);
    filename = "views-report.csv";
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

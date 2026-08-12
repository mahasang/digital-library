import { NextResponse, type NextRequest } from "next/server";
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
import { roleLabels } from "@/lib/labels";
import type { UserRole } from "@/types/research";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "ระบบยังไม่ได้เชื่อมต่อ Supabase" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงรายงานนี้" }, { status: 403 });
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
      { key: "titleTh", label: "ชื่อเรื่อง" },
      { key: "slug", label: "รหัสงานวิจัย" },
      { key: "count", label: "จำนวนดาวน์โหลด" },
    ]);
    filename = "downloads-report.csv";
  } else if (type === "popular") {
    const rows = await getPopularReport({ categoryId });
    csv = toCsv(rows, [
      { key: "titleTh", label: "ชื่อเรื่อง" },
      { key: "slug", label: "รหัสงานวิจัย" },
      { key: "views", label: "ยอดเข้าชม" },
      { key: "downloads", label: "ยอดดาวน์โหลด" },
    ]);
    filename = "popular-research-report.csv";
  } else if (type === "members") {
    const rows = await getMembersReport({ from, to, role });
    const mapped = rows.map((r) => ({ ...r, roleLabel: roleLabels[r.role] }));
    csv = toCsv(mapped, [
      { key: "fullName", label: "ชื่อ-นามสกุล" },
      { key: "email", label: "อีเมล" },
      { key: "organizationName", label: "หน่วยงาน" },
      { key: "roleLabel", label: "บทบาท" },
      { key: "createdAt", label: "วันที่สมัคร" },
    ]);
    filename = "members-report.csv";
  } else {
    const rows = await getViewsReport({ from, to, categoryId });
    csv = toCsv(rows, [
      { key: "titleTh", label: "ชื่อเรื่อง" },
      { key: "slug", label: "รหัสงานวิจัย" },
      { key: "count", label: "จำนวนครั้งที่อ่าน" },
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

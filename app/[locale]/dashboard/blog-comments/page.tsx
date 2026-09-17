export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Search, MessageSquare } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { createClient } from "@/lib/supabase/server";
import { DeleteCommentButton } from "./DeleteCommentButton";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "ຄຳເຫັນ Blog",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ເມື່ອກີ້";
  if (mins < 60) return `${mins} ນາທີ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ຊົ່ວໂມງ`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ວັນ`;
  return new Date(dateStr).toLocaleDateString("lo-LA");
}

export default async function BlogCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/blog-comments", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // สถิติรวม (ทุกหน้า ไม่ใช่แค่หน้าปัจจุบัน) — query แยกจาก list หลัก เอาแค่
  // คอลัมน์ที่จำเป็นสำหรับนับ distinct เพื่อไม่ต้องดึงทุกแถวแบบเต็ม
  let statsQuery = supabase
    .from("comments")
    .select("blog_post_id, user_id", { count: "exact" })
    .not("blog_post_id", "is", null);
  if (q) statsQuery = statsQuery.ilike("content", `%${q}%`);
  const { data: statsRows, count: totalCount } = await statsQuery;
  const totalComments = totalCount ?? 0;
  const uniquePostCount = new Set((statsRows ?? []).map((r) => r.blog_post_id).filter(Boolean)).size;
  const uniqueUserCount = new Set((statsRows ?? []).map((r) => r.user_id)).size;
  const totalPages = Math.ceil(totalComments / PAGE_SIZE);

  // ดึง blog comments พร้อม join blog_posts — comments.user_id ไม่มี foreign
  // key ไปยัง profiles ในฐานข้อมูลจริง (schema drift ระหว่าง local/production
  // ดู supabase/migrations/20260904140000_delete_own_account.sql) จึง embed
  // profiles ผ่าน PostgREST ตรงๆ ไม่ได้ — ต้อง query profiles แยกแล้ว join เอง
  let query = supabase
    .from("comments")
    .select(`
      id, content, created_at, user_id,
      blog_posts!inner ( id, title_lo, slug )
    `)
    .not("blog_post_id", "is", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike("content", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) console.error("[dashboard/blog-comments] fetch error:", error.message);

  const comments = data ?? [];

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const profileById = new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ຄຳເຫັນ Blog</h1>
        <p className="mt-1 text-sm text-gray-500">
          ຄຳເຫັນທັງໝົດທີ່ຜູ້ໃຊ້ຂຽນໃຕ້ບົດຄວາມ
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalComments}</p>
          <p className="mt-0.5 text-xs text-gray-500">ຄຳເຫັນທັງໝົດ</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{uniquePostCount}</p>
          <p className="mt-0.5 text-xs text-gray-500">ບົດຄວາມທີ່ມີຄຳເຫັນ</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{uniqueUserCount}</p>
          <p className="mt-0.5 text-xs text-gray-500">ຜູ້ໃຊ້ທີ່ຄຳເຫັນ</p>
        </div>
      </div>

      {/* Search */}
      <form
        method="get"
        className="flex gap-3 rounded-xl border border-gray-200 bg-surface p-4"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາເນື້ອຫາຄຳເຫັນ..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ຄົ້ນຫາ
        </button>
      </form>

      {/* List */}
      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">ບໍ່ມີຄຳເຫັນ</p>
          </div>
        ) : (
          comments.map((comment) => {
            const profile = profileById.get(comment.user_id);
            const authorName = profile?.full_name || profile?.email || "ຜູ້ໃຊ້ທີ່ບໍ່ຮູ້ຈັກ";
            const initials = authorName.slice(0, 2).toUpperCase();

            return (
              <div
                key={comment.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                {/* Left */}
                <div className="flex min-w-0 flex-1 gap-3">
                  {/* Avatar */}
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-9 w-9 object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Meta */}
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {authorName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {comment.created_at ? timeAgo(comment.created_at) : ""}
                      </span>
                    </div>

                    {/* Post link */}
                    {comment.blog_posts && (
                      <a
                        href={`/lo/blog/${comment.blog_posts.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 inline-block text-xs text-brand-600 hover:underline"
                      >
                        📄 {comment.blog_posts.title_lo}
                      </a>
                    )}

                    {/* Content */}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                      {comment.content}
                    </p>
                  </div>
                </div>

                {/* Right: Delete */}
                <div className="shrink-0">
                  <DeleteCommentButton commentId={comment.id} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(p) => `/dashboard/blog-comments?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      />
    </div>
  );
}

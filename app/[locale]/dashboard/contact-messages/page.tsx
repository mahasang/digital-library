import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Mail, Phone, Search } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { createClient } from "@/lib/supabase/server";
import StatusUpdater from "./StatusUpdater";

export const metadata: Metadata = {
  title: "ຂໍ້ຄວາມຕິດຕໍ່",
};

type ContactMessageStatus = "unread" | "read" | "replied";

const STATUS_LABEL: Record<ContactMessageStatus, string> = {
  unread:  "ຍັງບໍ່ໄດ້ອ່ານ",
  read:    "ອ່ານແລ້ວ",
  replied: "ຕອບແລ້ວ",
};

const STATUS_COLOR: Record<ContactMessageStatus, string> = {
  unread:  "bg-amber-100 text-amber-800",
  read:    "bg-gray-100 text-gray-700",
  replied: "bg-green-100 text-green-800",
};

const STATUS_VALUES: ContactMessageStatus[] = ["unread", "read", "replied"];

export default async function ContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/contact-messages", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const params = await searchParams;
  const statusFilter = STATUS_VALUES.includes(params.status as ContactMessageStatus)
    ? (params.status as ContactMessageStatus)
    : undefined;
  const q = params.q?.trim() ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("contact_messages")
    .select("id, first_name, last_name, email, phone, message, status, created_at")
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) console.error("[contact-messages] fetch error:", error.message);

  const messages: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    message: string;
    status: ContactMessageStatus;
    created_at: string;
  }[] = (data ?? []).map((row) => ({ ...row, status: row.status as ContactMessageStatus }));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ຂໍ້ຄວາມຕິດຕໍ່</h1>
        <p className="mt-1 text-sm text-gray-500">
          ຂໍ້ຄວາມທີ່ຜູ້ໃຊ້ສົ່ງຜ່ານຟອມຕິດຕໍ່
        </p>
      </div>

      {/* ── Filter ── */}
      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາຊື່ ຫຼື ອີເມວ..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ທຸກສະຖານະ</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ຄົ້ນຫາ
        </button>
      </form>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_VALUES.map((s) => {
          const count = messages.filter((m) => m.status === s).length;
          return (
            <div key={s} className="rounded-xl border border-gray-200 bg-surface p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="mt-0.5 text-xs text-gray-500">{STATUS_LABEL[s]}</p>
            </div>
          );
        })}
      </div>

      {/* ── List ── */}
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
            ບໍ່ມີຂໍ້ຄວາມ
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              {/* ── Left ── */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[msg.status]}`}>
                    {STATUS_LABEL[msg.status]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.created_at).toLocaleDateString("lo-LA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="font-semibold text-gray-900">
                  {msg.first_name} {msg.last_name}
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  <a href={`mailto:${msg.email}`} className="flex items-center gap-1 hover:text-brand-600">
                    <Mail className="h-3.5 w-3.5" />
                    {msg.email}
                  </a>
                  {msg.phone && (
                    <a href={`tel:${msg.phone}`} className="flex items-center gap-1 hover:text-brand-600">
                      <Phone className="h-3.5 w-3.5" />
                      {msg.phone}
                    </a>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                  {msg.message}
                </p>
              </div>

              {/* ── Right: Status updater ── */}
              <StatusUpdater id={msg.id} currentStatus={msg.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
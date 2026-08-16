import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAdminUserList } from "@/lib/data/admin-users.server";
import UserManager from "@/components/dashboard/UserManager";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("users.pageTitle") };
}

export default async function DashboardUsersPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/users", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) return redirect({ href: "/403", locale });

  const t = await getTranslations("dashboard");
  const users = await getAdminUserList();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("users.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("users.subtitle")}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          {t("users.empty")}
        </div>
      ) : (
        <UserManager users={users} currentUserId={user.id} />
      )}
    </div>
  );
}

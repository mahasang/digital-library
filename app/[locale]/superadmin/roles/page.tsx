import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Info, Crown } from "lucide-react";
import type { UserRole } from "@/types/research";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("roles.pageTitle") };
}

interface RoleInfo {
  role: UserRole;
  rank: number;
  permissionsKey: string;
}

const ROLE_MATRIX: RoleInfo[] = [
  { role: "member", rank: 10, permissionsKey: "member" },
  { role: "staff", rank: 20, permissionsKey: "staff" },
  { role: "librarian", rank: 30, permissionsKey: "librarian" },
  { role: "admin", rank: 40, permissionsKey: "admin" },
  { role: "super_admin", rank: 50, permissionsKey: "super_admin" },
];

export default async function SuperAdminRolesPage() {
  const t = await getTranslations("superadmin.roles");
  const tRoles = await getTranslations("roles");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t("infoBox")}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ROLE_MATRIX.map((info) => {
          const permissions = t.raw(`permissions.${info.permissionsKey}`) as string[];
          return (
            <section
              key={info.role}
              className="rounded-xl border border-gray-200 bg-surface p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                {info.role === "super_admin" && <Crown className="h-4 w-4 text-amber-600" />}
                <h2 className="text-sm font-semibold text-gray-900">{tRoles(info.role)}</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {t("rankLabel", { rank: info.rank })}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {permissions.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

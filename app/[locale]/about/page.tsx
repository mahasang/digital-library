import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  Search,
  ShieldCheck,
  Users,
  FileCheck2,
  BarChart3,
} from "lucide-react";
import Container from "@/components/ui/Container";
import type { UserRole } from "@/types/research";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const FEATURE_KEYS = ["search", "readOnline", "accessControl", "reviewProcess", "multiRole", "stats"] as const;
const FEATURE_ICONS = {
  search: Search,
  readOnline: BookOpen,
  accessControl: ShieldCheck,
  reviewProcess: FileCheck2,
  multiRole: Users,
  stats: BarChart3,
};

const ROLE_KEYS: UserRole[] = ["guest", "member", "staff", "librarian", "admin"];

export default async function AboutPage() {
  const t = await getTranslations("about");
  const tRoles = await getTranslations("roles");

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("heading")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
            {t("intro")}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((key) => {
            const Icon = FEATURE_ICONS[key];
            return (
              <div
                key={key}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-semibold text-gray-900">{t(`features.${key}.title`)}</h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-xl font-bold text-gray-900">
            {t("rolesTitle")}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            {t("rolesSubtitle")}
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("colRole")}</th>
                  <th className="px-4 py-3 font-medium">{t("colDescription")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ROLE_KEYS.map((role) => (
                  <tr key={role}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                      {tRoles(role)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t(`roleDescriptions.${role}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </div>
  );
}

export const dynamic = "force-dynamic";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import AccountShell from "@/components/account/AccountShell";
import AccountEmptyState from "@/components/account/AccountEmptyState";
import AccountResearchRow from "@/components/account/AccountResearchRow";
import ReadingHistoryBlogRow from "@/components/account/ReadingHistoryBlogRow";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import Container from "@/components/ui/Container";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getReadingHistory } from "@/lib/data/favorites.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("readingHistory");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function ReadingHistoryPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const locale = await getLocale();
  const t = await getTranslations("readingHistory");
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/reading-history", locale });

  const history = await getReadingHistory(user.id);

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">{t("pageTitle")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>

      <div className="mt-6">
        {history.length === 0 ? (
          <AccountEmptyState
            icon={BookOpen}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <LinkButton href="/research" variant="primary" size="sm">
                {t("browseResearch")}
              </LinkButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((entry, index) => (
              <div key={`${entry.type}-${entry.item.id}-${index}`} className="relative">
                {entry.type === "research" ? (
                  <AccountResearchRow item={entry.item} readAt={entry.readAt} />
                ) : (
                  <ReadingHistoryBlogRow item={entry.item} readAt={entry.readAt} />
                )}
                <span
                  className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    entry.type === "research"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-brand-50 text-brand-600"
                  }`}
                >
                  {entry.type === "research" ? t("researchBadge") : t("blogBadge")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountShell>
  );
}

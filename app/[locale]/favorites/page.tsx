export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import AccountShell from "@/components/account/AccountShell";
import AccountEmptyState from "@/components/account/AccountEmptyState";
import AccountResearchRow from "@/components/account/AccountResearchRow";
import AccountBlogRow from "@/components/account/AccountBlogRow";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import Container from "@/components/ui/Container";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getFavoriteResearch, getFavoriteBlogPosts } from "@/lib/data/favorites.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return {
    title: t("favorites.title"),
    description: t("favorites.description"),
  };
}

export default async function FavoritesPage() {
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
  const t = await getTranslations("account");
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/favorites");

  const [researchItems, blogPosts] = await Promise.all([
    getFavoriteResearch(user.id),
    getFavoriteBlogPosts(user.id),
  ]);

  const totalCount = researchItems.length + blogPosts.length;

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">{t("favorites.title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("favorites.description")}</p>

      {totalCount === 0 ? (
        <div className="mt-6">
          <AccountEmptyState
            icon={Heart}
            title={t("favorites.empty")}
            description={t("favorites.emptyHint")}
            action={
              <LinkButton href="/research" variant="primary" size="sm">
                {t("favorites.browseResearch")}
              </LinkButton>
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* Research favorites */}
          {researchItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t("favorites.sectionResearch")} ({researchItems.length})
              </h2>
              <div className="flex flex-col gap-3">
                {researchItems.map((item) => (
                  <AccountResearchRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Blog favorites */}
          {blogPosts.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t("favorites.sectionBlog")} ({blogPosts.length})
              </h2>
              <div className="flex flex-col gap-3">
                {blogPosts.map((post) => (
                  <AccountBlogRow key={post.id} post={post} locale={locale} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AccountShell>
  );
}

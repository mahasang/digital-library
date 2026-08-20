import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import { getPublicAuthorProfile, getPublicAuthorResearch } from "@/lib/data/authors-public.server";
import { AuthorProfileCard } from "@/components/authors/AuthorProfileCard";
import { AuthorResearchList } from "@/components/authors/AuthorResearchList";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const author = await getPublicAuthorProfile(id);
  if (!author) return {};

  return {
    title: author.displayNameEn ? `${author.name} (${author.displayNameEn})` : author.name,
    description: author.biography?.slice(0, 160) ?? undefined,
  };
}

export default async function AuthorProfilePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("authors");

  const [author, research] = await Promise.all([
    getPublicAuthorProfile(id),
    getPublicAuthorResearch(id),
  ]);

  if (!author) notFound();

  return (
    <Container className="max-w-4xl py-8">
      <AuthorProfileCard author={author} />
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{t("publishedResearch")}</h2>
        <AuthorResearchList research={research} />
      </div>
    </Container>
  );
}

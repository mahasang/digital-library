import { BookOpen, ExternalLink, Building2, BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { PublicAuthorProfile } from "@/lib/data/authors-public.server";

type Props = {
  author: PublicAuthorProfile;
};

export async function AuthorProfileCard({ author }: Props) {
  const t = await getTranslations("authors");
  const isOrcidVerified = Boolean(author.orcidVerifiedAt || author.orcidOauthVerifiedAt);

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {author.titlePrefixTh ? `${author.titlePrefixTh} ` : ""}
            {author.name}
          </h1>
          {author.displayNameEn && (
            <p className="mt-0.5 text-gray-500">
              {author.titlePrefixEn ? `${author.titlePrefixEn} ` : ""}
              {author.displayNameEn}
            </p>
          )}
          {author.organization && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{author.organization.nameTh}</span>
            </div>
          )}
          {author.orcid && (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm">
              <a
                href={`https://orcid.org/${author.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-700 hover:underline"
              >
                <span className="font-mono">{author.orcid}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {isOrcidVerified && (
                <span className="flex items-center gap-0.5 text-xs text-green-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("orcidVerified")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {author.biography && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {author.biography}
          </p>
        </div>
      )}
    </div>
  );
}

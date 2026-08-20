import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PublicAuthorResearch } from "@/lib/data/authors-public.server";

type Props = {
  research: PublicAuthorResearch[];
};

export async function AuthorResearchList({ research }: Props) {
  const t = await getTranslations("authors");

  if (research.length === 0) {
    return <p className="text-sm text-gray-500">{t("noPublishedResearch")}</p>;
  }

  return (
    <ul className="space-y-3">
      {research.map((item) => (
        <li key={item.id}>
          <Link
            href={`/research/${item.id}`}
            className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
          >
            <p className="line-clamp-2 font-medium text-gray-900">{item.titleTh}</p>
            {item.titleEn && (
              <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{item.titleEn}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {item.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.slug}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {cat.nameTh}
                </span>
              ))}
              {item.publishedAt && (
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(item.publishedAt).getFullYear()}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}

type PageToken = number | "ellipsis";

/**
 * เลขหน้าที่แสดง: หน้าแรก, หน้าสุดท้าย, หน้าปัจจุบัน ±1 เสมอ — ใส่ ellipsis
 * แทนช่วงที่ข้าม (เช่น totalPages=10, currentPage=5 → 1 … 4 5 6 … 10)
 */
function getPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const tokens: PageToken[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) tokens.push("ellipsis");
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < totalPages - 1) tokens.push("ellipsis");

  tokens.push(totalPages);
  return tokens;
}

export default async function Pagination({
  currentPage,
  totalPages,
  buildHref,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const t = await getTranslations("pagination");
  const tokens = getPageTokens(currentPage, totalPages);

  return (
    <nav
      aria-label={t("pageOf", { current: currentPage, total: totalPages })}
      className={`mt-10 flex items-center justify-center gap-2 ${className}`}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ← {t("previous")}
        </Link>
      ) : (
        <span className="cursor-not-allowed rounded-lg border border-gray-100 px-4 py-2 text-sm font-medium text-gray-300">
          ← {t("previous")}
        </span>
      )}

      {tokens.map((token, i) =>
        token === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={token}
            href={buildHref(token)}
            aria-current={token === currentPage ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              token === currentPage
                ? "bg-brand-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {token}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {t("next")} →
        </Link>
      ) : (
        <span className="cursor-not-allowed rounded-lg border border-gray-100 px-4 py-2 text-sm font-medium text-gray-300">
          {t("next")} →
        </span>
      )}
    </nav>
  );
}

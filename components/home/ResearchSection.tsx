import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Container from "@/components/ui/Container";
import ResearchGrid from "@/components/research/ResearchGrid";
import type { ResearchItem } from "@/types/research";

export default async function ResearchSection({
  title,
  description,
  icon: Icon,
  items,
  tone = "light",
  variant = "default",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: ResearchItem[];
  tone?: "light" | "muted";
  /** "latest" แสดงวันที่เผยแพร่แทนปี, "popular" แสดงตราอันดับ — เพื่อให้สอง
   * ส่วนนี้อ่านออกได้ทันทีว่าต่างกันจริง (คนละเกณฑ์การเรียงลำดับ) ไม่ใช่กริด
   * ซ้ำหน้ากัน */
  variant?: "default" | "latest" | "popular";
}) {
  const t = await getTranslations("home");

  return (
    <section className={`py-14 sm:py-16 ${tone === "muted" ? "bg-gray-50" : ""}`}>
      <Container>
        <div className="mb-8 flex items-end justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-h2 font-semibold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <Link
            href="/research"
            className="hidden items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong sm:flex"
          >
            {t("viewAllResearch")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ResearchGrid
          items={items}
          rankStart={variant === "popular" ? 1 : undefined}
          footerMode={variant === "latest" ? "recency" : "default"}
        />
      </Container>
    </section>
  );
}

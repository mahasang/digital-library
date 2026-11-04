import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCategoryIcon } from "@/lib/icons";
import { getCategoryName } from "@/lib/categoryName";
import type { Category } from "@/types/research";

/**
 * Hallmark — homepage data-flow optimization: รับรายการหมวดหมู่และจำนวนที่นับไว้
 * แล้วเป็น props (คำนวณรวมที่ app/page.tsx จาก getPublishedResearchStats()
 * ครั้งเดียว) ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้
 *
 * H1 (UI/UX): แสดงเป็นดัชนีแบบบัตรรายการห้องสมุด — แถวไอคอน + ชื่อ + จำนวนชิดขวา
 * คั่นด้วยเส้นบาง แทนการ์ดกล่อง จำนวนหมวดจึงเปลี่ยนได้โดยไม่เหลือช่องว่างในกริด
 * 3 คอลัมน์บนเดสก์ท็อป 2 คอลัมน์บนแท็บเล็ต 1 คอลัมน์บนมือถือ
 */
export default async function CategorySection({
  categories,
  countByCategoryId,
}: {
  categories: Category[];
  countByCategoryId: Record<string, number>;
}) {
  const t = await getTranslations("home");
  const locale = await getLocale();

  return (
    <section className="py-10 sm:py-12">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading text-h2 font-medium text-gray-900">
              {t("categoryHeading")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t("categorySubtitle")}</p>
          </div>
          <Link
            href="/research"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong dark:text-accent-ink sm:flex"
          >
            {t("viewAllResearch")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid border-t border-border sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const count = countByCategoryId[category.id] ?? 0;
            return (
              <li key={category.id} className="border-b border-border">
                <Link
                  href={`/research?category=${category.id}`}
                  className="group flex min-h-12 items-center gap-3 py-2 transition-colors"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-gray-500 transition-colors group-hover:text-accent-ink" strokeWidth={1.5} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900 transition-colors group-hover:text-accent-ink">
                    {getCategoryName(category, locale)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {t("categoryCount", { count })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

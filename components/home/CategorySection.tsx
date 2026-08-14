import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCategoryIcon } from "@/lib/icons";
import type { Category } from "@/types/research";

/**
 * Hallmark — homepage data-flow optimization: เดิมดึง getPublishedResearch()
 * (ทุกคอลัมน์/ทุกความสัมพันธ์) และ getCategories() เองแยกจาก app/page.tsx
 * แล้วนับจำนวนต่อหมวดหมู่ด้วย items.filter(...).length ในคอมโพเนนต์นี้ —
 * ตอนนี้รับทั้งรายการหมวดหมู่และจำนวนที่นับไว้แล้วเป็น props แทน (คำนวณรวมที่
 * app/page.tsx จาก getPublishedResearchStats() ครั้งเดียว) ไม่มีการดึงข้อมูล
 * ในคอมโพเนนต์นี้อีกต่อไป หน้าตา/ข้อความที่แสดงเหมือนเดิมทุกประการ
 */
export default async function CategorySection({
  categories,
  countByCategoryId,
}: {
  categories: Category[];
  countByCategoryId: Record<string, number>;
}) {
  const t = await getTranslations("home");

  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-h2 font-semibold text-gray-900">
              {t("categoryHeading")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("categorySubtitle")}
            </p>
          </div>
          <Link
            href="/research"
            className="hidden items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong sm:flex"
          >
            {t("viewAllResearch")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const count = countByCategoryId[category.id] ?? 0;
            return (
              <Link
                key={category.id}
                href={`/research?category=${category.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent-ink group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {category.nameTh}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t("categoryCount", { count })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

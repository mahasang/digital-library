import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCategoryIcon } from "@/lib/icons";
import type { Category } from "@/types/research";

/**
 * Hallmark — homepage data-flow optimization: รับรายการหมวดหมู่และจำนวนที่นับไว้
 * แล้วเป็น props (คำนวณรวมที่ app/page.tsx จาก getPublishedResearchStats()
 * ครั้งเดียว) ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้
 *
 * H1 (UI/UX): เปลี่ยนจากการ์ดสูง (ไอคอนอยู่บนชื่อ) เป็นแถวกะทัดรัดไอคอน + ชื่อ +
 * จำนวนในบรรทัดเดียว — 10 หมวดจึงเหลือ 2 แถวบนเดสก์ท็อป (5 คอลัมน์) และ 5 แถว
 * บนมือถือ (2 คอลัมน์) แทนที่จะกินเกือบหนึ่งหน้าจอ ไม่มี hover ที่ยกการ์ดขึ้น
 * เปลี่ยนเฉพาะสีขอบ/พื้นเพื่อบอกว่ากดได้
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
    <section className="py-10 sm:py-12">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading text-h2 font-semibold text-gray-900">
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

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const count = countByCategoryId[category.id] ?? 0;
            return (
              <li key={category.id}>
                <Link
                  href={`/research?category=${category.id}`}
                  className="group flex h-full min-h-14 items-center gap-3 rounded-lg border border-gray-200 bg-surface px-3 py-2.5 transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink transition-colors group-hover:bg-accent group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-sm font-semibold leading-snug text-gray-900">
                      {category.nameTh}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {t("categoryCount", { count })}
                    </span>
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

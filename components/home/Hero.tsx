import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Container from "@/components/ui/Container";
import HomeSearchBox from "@/components/home/HomeSearchBox";
import HeroShelf from "@/components/home/shelf/HeroShelf";
import StaticShelfList from "@/components/home/shelf/StaticShelfList";
import { toShelfBook } from "@/components/home/shelf/toShelfBook";
import { getCategoryName } from "@/lib/categoryName";
import type { Category, ResearchItem } from "@/types/research";

/**
 * Hallmark — หน้าแรก H1 (UI/UX)
 *
 * - บน: หัวข้อ → ช่องค้นหา → ทางลัดหมวดหมู่ (ลำดับตามงานที่คนมาทำคือค้นหาเอกสาร)
 *   และแถบสถิติ ทางลัดเป็นลิงก์ตัวอักษรและสถิติเป็นเส้นแบ่งบางๆ เพื่อให้ช่องค้นหา
 *   เป็นสิ่งเดียวที่เด่น
 * - ล่าง: ชั้นงานวิจัยล่าสุดเต็มความกว้าง ดู components/home/shelf/
 * - ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้ — รับทุกอย่างเป็น props จาก
 *   app/[locale]/page.tsx เหมือนเดิม
 */
export default async function Hero({
  publishedCount,
  categoryCount,
  organizationCount,
  categories,
  allCategories,
  shelf,
}: {
  publishedCount: number;
  categoryCount: number;
  organizationCount: number;
  /** หมวดหมู่ที่มีงานเผยแพร่มากที่สุด (เรียงแล้ว) แสดงเป็นทางลัดใต้ช่องค้นหา */
  categories: Category[];
  /** หมวดหมู่ทั้งหมด ใช้หาหมวดหมู่ของปกบนชั้นหนังสือ */
  allCategories: Category[];
  /** งานล่าสุดสำหรับชั้นหนังสือ พร้อมบทคัดย่อ — ถ้ามีน้อยกว่า 2 เล่มจะไม่แสดงชั้น */
  shelf: ResearchItem[];
}) {
  const t = await getTranslations("home");
  const locale = await getLocale();

  const stats = [
    { label: t("statPublished"), value: publishedCount },
    { label: t("statCategories"), value: categoryCount },
    { label: t("statOrganizations"), value: organizationCount },
  ];

  const showShelf = shelf.length >= 2;

  return (
    <section className="relative overflow-hidden bg-brand-900 dark:border-b dark:border-border dark:bg-brand-950">
      <Container className="relative grid items-end gap-8 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-12">
        <div className="min-w-0">
          <h1 className="max-w-2xl text-h1 font-medium text-white sm:text-display lg:text-4xl">
            <span className="block">{t("heroHeadingLine1")}</span>
            <span className="block">{t("heroHeadingLine2")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-100/80 sm:text-base">
            {t("heroSubtitle")}
          </p>

          <div className="mt-8 max-w-xl">
            <HomeSearchBox />
          </div>

          <ul className="mt-3 flex max-w-xl flex-wrap items-center gap-x-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/research?category=${category.id}`}
                  className="inline-flex min-h-9 items-center text-sm text-brand-100 transition-colors hover:text-white"
                >
                  {getCategoryName(category, locale)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/research"
                className="inline-flex min-h-9 items-center text-sm text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
              >
                {t("browseAllResearch")}
              </Link>
            </li>
          </ul>
        </div>

        <dl className="grid max-w-xl grid-cols-3 border-t border-white/15 pt-5">
          {stats.map(({ label, value }, index) => (
            <div
              key={label}
              className={`flex flex-col-reverse justify-end gap-1 ${
                index > 0 ? "border-l border-white/15 pl-4 sm:pl-6" : ""
              }`}
            >
              <dt className="text-xs leading-snug text-brand-100/75 sm:text-sm">{label}</dt>
              <dd className="text-xl font-medium tabular-nums text-white sm:text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
      </Container>

      {showShelf && (
        <HeroShelf books={shelf.map((item) => toShelfBook(item, allCategories, locale))}>
          <StaticShelfList items={shelf} categories={allCategories} />
        </HeroShelf>
      )}
    </section>
  );
}

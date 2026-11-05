import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import HomeSearchBox from "@/components/home/HomeSearchBox";
import HeroShelf from "@/components/home/shelf/HeroShelf";
import StaticShelfList from "@/components/home/shelf/StaticShelfList";
import { toShelfBook } from "@/components/home/shelf/toShelfBook";
import type { Category, ResearchItem } from "@/types/research";

/**
 * Hallmark — หน้าแรก H1 (UI/UX)
 *
 * ชั้นหนังสือคือตัวเอกของหน้าจอแรก ส่วนหัวข้อและช่องค้นหาเป็นบล็อกเล็กมุมซ้ายบน
 * ทางลัดหมวดหมู่อยู่ใน CategorySection ถัดไปจึงไม่ซ้ำไว้ที่นี่
 * ดูรายละเอียดของชั้นที่ components/home/shelf/
 *
 * ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้ — รับทุกอย่างเป็น props จาก app/[locale]/page.tsx
 */
export default async function Hero({
  allCategories,
  shelf,
}: {
  /** หมวดหมู่ทั้งหมด ใช้หาหมวดหมู่ของปกบนชั้นหนังสือ */
  allCategories: Category[];
  /** งานล่าสุดสำหรับชั้นหนังสือ พร้อมบทคัดย่อ — ถ้ามีน้อยกว่า 2 เล่มจะไม่แสดงชั้น */
  shelf: ResearchItem[];
}) {
  const t = await getTranslations("home");
  const locale = await getLocale();

  const intro = (
    <>
      <h1 className="text-sm font-medium leading-snug text-[#2B2118]">
        {t("heroHeadingLine1")} {t("heroHeadingLine2")}
      </h1>
      <div className="mt-3">
        <HomeSearchBox />
      </div>
      <Link
        href="/research"
        className="mt-1 inline-flex min-h-9 items-center text-sm text-[#2B2118] underline decoration-[#2B2118]/40 underline-offset-4 transition-colors hover:decoration-[#2B2118]"
      >
        {t("browseAllResearch")}
      </Link>
    </>
  );

  if (shelf.length < 2) {
    return (
      <section className="bg-[#E7E2D8] px-4 py-12">
        <div className="mx-auto max-w-md">{intro}</div>
      </section>
    );
  }

  return (
    <HeroShelf
      books={shelf.map((item) => toShelfBook(item, allCategories, locale))}
      intro={intro}
    >
      <StaticShelfList items={shelf} categories={allCategories} />
    </HeroShelf>
  );
}

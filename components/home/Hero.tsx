import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Container from "@/components/ui/Container";
import CategoryCover from "@/components/research/CategoryCover";
import HomeSearchBox from "@/components/home/HomeSearchBox";
import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryById } from "@/data/categories";
import type { Category, ResearchItem } from "@/types/research";

/**
 * Hallmark — หน้าแรก H1 (UI/UX): Hero ชิดซ้าย 2 คอลัมน์
 *
 * - ซ้าย: หัวข้อ → ช่องค้นหา → ทางลัดหมวดหมู่ → แถบสถิติ (ลำดับตามงานที่คนมาทำ
 *   คือค้นหาเอกสาร) ทางลัดเป็นลิงก์ตัวอักษรและสถิติเป็นเส้นแบ่งบางๆ เพื่อให้
 *   ช่องค้นหาเป็นสิ่งเดียวที่เด่นในคอลัมน์นี้
 * - ขวา (เฉพาะจอ ≥1024px): "ชั้นหนังสือ" งานล่าสุด 3 เล่มตั้งบนเส้นชั้น กดเข้าอ่าน
 *   ได้จากหน้าจอแรกทันที เล่มที่ไม่มีปกจริงแสดงเป็นหน้าปกเรียงพิมพ์จาก
 *   CategoryCover ซ่อนบนมือถือเพราะแถวเลื่อนด้านล่างทำหน้าที่เดียวกันอยู่แล้ว
 *   (และไม่ใช้ `priority` เพื่อไม่ให้มือถือโหลดรูปที่มองไม่เห็น)
 * - ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้ — รับทุกอย่างเป็น props จาก
 *   app/[locale]/page.tsx เหมือนเดิม
 */
export default async function Hero({
  publishedCount,
  categoryCount,
  organizationCount,
  categories,
  shelf,
}: {
  publishedCount: number;
  categoryCount: number;
  organizationCount: number;
  /** หมวดหมู่ที่มีงานเผยแพร่มากที่สุด (เรียงแล้ว) แสดงเป็นทางลัดใต้ช่องค้นหา */
  categories: Category[];
  /** งานล่าสุดสำหรับชั้นหนังสือ — ถ้ามีน้อยกว่า 2 เล่มจะไม่แสดงชั้น */
  shelf: ResearchItem[];
}) {
  const t = await getTranslations("home");

  const stats = [
    { label: t("statPublished"), value: publishedCount },
    { label: t("statCategories"), value: categoryCount },
    { label: t("statOrganizations"), value: organizationCount },
  ];

  const showShelf = shelf.length >= 2;

  return (
    <section className="relative overflow-hidden bg-brand-900 dark:border-b dark:border-border dark:bg-brand-950">
      <Container
        className={`relative grid items-center gap-10 py-12 sm:py-16 lg:py-20 ${
          showShelf ? "lg:grid-cols-2 lg:gap-12" : ""
        }`}
      >
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
                  {category.nameTh}
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

          <dl className="mt-8 grid max-w-xl grid-cols-3 border-t border-white/15 pt-5">
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
        </div>

        {showShelf && (
          <ul className="hidden items-end justify-center gap-4 border-b border-white/25 lg:flex xl:gap-5">
            {shelf.map((item) => (
              <li key={item.id} className="w-full max-w-[11.5rem]">
                <Link
                  href={`/research/${item.id}`}
                  aria-label={item.titleTh}
                  className="relative block aspect-[4/5.6] overflow-hidden rounded-r-md rounded-l-sm shadow-xl shadow-black/30 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1"
                >
                  {hasRealCoverImage(item.coverImage) ? (
                    <>
                      <Image
                        src={item.coverImage}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 184px, 15vw"
                        className="object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-10 text-xs font-medium leading-snug text-white">
                        {item.titleTh}
                      </span>
                    </>
                  ) : (
                    <CategoryCover
                      category={getCategoryById(item.categoryId)}
                      title={item.titleTh}
                      author={item.researchers.map((r) => r.name).join(", ")}
                      year={item.year}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

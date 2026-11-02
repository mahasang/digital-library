import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Container from "@/components/ui/Container";
import HomeSearchBox from "@/components/home/HomeSearchBox";
import type { Category, ResearchItem } from "@/types/research";

/**
 * Hallmark — หน้าแรก H1 (UI/UX): Hero ชิดซ้าย 2 คอลัมน์
 *
 * - ซ้าย: หัวข้อ → ช่องค้นหา → ทางลัดหมวดหมู่ → แถบสถิติ (ลำดับตามงานที่คนมาทำ
 *   คือค้นหาเอกสาร) แถบสถิติเป็นเส้นแบ่งบางๆ แทนการ์ด 3 กล่องเดิม
 * - ขวา (เฉพาะจอ ≥1024px): "ชั้นหนังสือ" ปกงานล่าสุด 3 ใบ กดเข้าอ่านได้จาก
 *   หน้าจอแรกทันที ซ่อนบนมือถือเพราะแถวเลื่อนด้านล่างทำหน้าที่เดียวกันอยู่แล้ว
 *   (และไม่ใช้ `priority` เพื่อไม่ให้มือถือโหลดรูปที่มองไม่เห็น)
 * - ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้ — รับทุกอย่างเป็น props จาก
 *   app/[locale]/page.tsx เหมือนเดิม
 * - ไม่มีข้อความใหม่: ใช้ key เดิมใน messages ทั้งหมด จึงไม่ต้องแปลเพิ่ม
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
  /** งานล่าสุดที่มีปกจริง (ไม่ใช่ placeholder) — ถ้ามีน้อยกว่า 2 ใบจะไม่แสดงชั้น */
  shelf: ResearchItem[];
}) {
  const t = await getTranslations("home");

  const stats = [
    { label: t("statPublished"), value: `${publishedCount}+` },
    { label: t("statCategories"), value: `${categoryCount}` },
    { label: t("statOrganizations"), value: `${organizationCount}` },
  ];

  const showShelf = shelf.length >= 2;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-brand-900 dark:border-b dark:border-border dark:from-brand-950 dark:via-brand-950 dark:to-background">
      <Container
        className={`relative grid items-center gap-10 py-12 sm:py-16 lg:py-20 ${
          showShelf ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14" : ""
        }`}
      >
        <div className="min-w-0">
          <h1 className="max-w-2xl text-h1 font-semibold text-white sm:text-display lg:text-4xl">
            {t("heroHeadingLine1")}
            <br className="hidden sm:block lg:hidden" /> {t("heroHeadingLine2")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-100/80 sm:text-base">
            {t("heroSubtitle")}
          </p>

          <div className="mt-7 max-w-xl">
            <HomeSearchBox />
          </div>

          <ul className="mt-4 flex max-w-xl flex-wrap items-center gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/research?category=${category.id}`}
                  className="inline-flex min-h-9 items-center rounded-full bg-white/10 px-3.5 text-sm text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
                >
                  {category.nameTh}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/research"
                className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
              >
                {t("browseAllResearch")}
              </Link>
            </li>
          </ul>

          <dl className="mt-9 grid max-w-xl grid-cols-3 border-t border-white/15 pt-5">
            {stats.map(({ label, value }, index) => (
              <div
                key={label}
                className={`flex flex-col-reverse justify-end gap-1 ${
                  index > 0 ? "border-l border-white/15 pl-4 sm:pl-6" : ""
                }`}
              >
                <dt className="text-xs leading-snug text-brand-100/75 sm:text-sm">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-white sm:text-2xl">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {showShelf && (
          <ul className="hidden items-center justify-center gap-4 lg:flex xl:gap-5">
            {shelf.map((item, index) => (
              <li
                key={item.id}
                className={`w-full max-w-[11.5rem] ${index === 1 ? "-translate-y-6" : "translate-y-5"}`}
              >
                <Link
                  href={`/research/${item.id}`}
                  className="group relative block aspect-[4/5.6] overflow-hidden rounded-lg shadow-2xl shadow-black/40 ring-1 ring-white/15"
                >
                  <Image
                    src={item.coverImage}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 184px, 15vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-10 text-xs font-semibold leading-snug text-white">
                    {item.titleTh}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

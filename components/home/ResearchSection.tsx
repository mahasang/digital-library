import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import ResearchCard from "@/components/research/ResearchCard";
import ResearchGrid from "@/components/research/ResearchGrid";
import type { ResearchItem } from "@/types/research";

/**
 * H1 (UI/UX): จำนวนการ์ดที่แสดงบนจอ ≥640px ต่อหนึ่งส่วน — หน้าแรกเป็น "ไฮไลต์"
 * ไม่ใช่รายการเต็ม (รายการเต็มอยู่ที่ /research) และห้องสมุดที่มีงานไม่มาก
 * ทำให้ส่วนล่าสุด/ยอดนิยมซ้ำกันเกือบทั้งหมดเมื่อแสดงอย่างละ 8 ใบ ส่วนมือถือ
 * แสดงครบทุกใบเท่าที่ Settings กำหนด (homepageLatestCount/homepagePopularCount)
 * ในแถวเลื่อนแนวนอน ถ้าต้องการให้เดสก์ท็อปแสดงครบ ให้เพิ่มค่านี้หรือลบ
 * เงื่อนไข `sm:hidden` ด้านล่าง
 */
const DESKTOP_VISIBLE = 4;

export default async function ResearchSection({
  title,
  description,
  items,
  variant = "default",
}: {
  title: string;
  description: string;
  items: ResearchItem[];
  /** "latest" แสดงวันที่เผยแพร่แทนปี, "popular" แสดงตราอันดับ — เพื่อให้สอง
   * ส่วนนี้อ่านออกได้ทันทีว่าต่างกันจริง (คนละเกณฑ์การเรียงลำดับ) ไม่ใช่กริด
   * ซ้ำหน้ากัน */
  variant?: "default" | "latest" | "popular";
}) {
  const t = await getTranslations("home");
  const rankStart = variant === "popular" ? 1 : undefined;
  const footerMode = variant === "latest" ? "recency" : "default";

  return (
    <section className="border-t border-border py-10 sm:py-12">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading text-h2 font-medium text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <Link
            href="/research"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong dark:text-accent-ink sm:flex"
          >
            {t("viewAllResearch")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {items.length === 0 ? (
          <ResearchGrid items={[]} />
        ) : (
          <>
            {/* มือถือ: แถวเลื่อนแนวนอน เห็นการ์ดใบถัดไปโผล่มาให้รู้ว่าเลื่อนได้
                (-mx-4/px-4 ให้แถวชนขอบจอแต่ยังเริ่มที่แนวเดียวกับหัวข้อ) ·
                ≥640px: กริด 2 คอลัมน์ (≥1024px: 4 คอลัมน์) */}
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0 lg:grid-cols-4">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={`w-[62vw] max-w-[15.5rem] shrink-0 snap-start sm:w-auto sm:max-w-none [&>a]:h-full ${
                    index >= DESKTOP_VISIBLE ? "sm:hidden" : ""
                  }`}
                >
                  <ResearchCard
                    item={item}
                    rank={rankStart !== undefined ? rankStart + index : undefined}
                    footerMode={footerMode}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-5 sm:hidden">
              <LinkButton href="/research" variant="outline" className="w-full">
                {t("viewAllResearch")}
              </LinkButton>
            </div>
          </>
        )}
      </Container>
    </section>
  );
}

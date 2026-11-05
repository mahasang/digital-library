export const dynamic = "force-dynamic";
import { getTranslations } from "next-intl/server";
import Hero from "@/components/home/Hero";
import CategorySection from "@/components/home/CategorySection";
import ResearchSection from "@/components/home/ResearchSection";
import { SHELF_SIZE } from "@/components/home/shelf/types";
import {
  getLatestResearch,
  getPopularResearch,
  getPublishedResearchStats,
  getShelfResearch,
} from "@/lib/data/research.server";
import { getCategories } from "@/lib/data/categories.server";
import { getPublicHomeSettings } from "@/lib/data/settings.server";

/**
 * Hallmark — homepage data-flow optimization. เดิม Hero/CategorySection ดึง
 * ข้อมูลของตัวเองแยกต่างหาก (getPublishedResearch/getCategories/getSettings
 * ซ้ำกับที่นี่, getPublishedResearch() แบบเต็มรูปแบบซ้ำอีกสองจุด) ทำให้หน้าแรก
 * หนึ่งครั้งมี query จริงมากถึง ~7-8 ครั้ง (บางคำสั่งดึงทุกแถว/ทุกความสัมพันธ์
 * เพื่อ .length หรือ .filter().length เท่านั้น) — ตอนนี้ดึงทุกอย่างที่นี่ที่
 * เดียว แล้วส่งลงเป็น props ให้ Hero/CategorySection/ResearchSection ทั้งหมด
 * ไม่มี component ใดในหน้าแรกดึงข้อมูลเองอีกต่อไป
 *
 * แบ่งเป็น 2 รอบ (ไม่ใช่ Promise.all เดียวทั้งหมด) เพราะ getLatestResearch()/
 * getPopularResearch() ต้องใช้ค่า homepageLatestCount/homepagePopularCount
 * จาก settings ก่อนถึงจะรู้ว่าต้อง LIMIT เท่าไร — เป็น data dependency จริงที่
 * มีอยู่แล้วในโค้ดเดิม ไม่ได้เพิ่มใหม่ ส่วนอีก 3 คำสั่งในรอบแรกไม่ขึ้นต่อกันเลย
 * จึงยิงพร้อมกันได้ทั้งหมด
 *
 * ใช้ getPublicHomeSettings() (Hallmark — public homepage caching) แทน
 * getSettings() เดิม — คืนเฉพาะ 4 ฟิลด์ที่หน้าแรกใช้จริงและ cache ข้าม
 * request/ผู้ใช้ได้อย่างปลอดภัย (ดูเหตุผลที่แยกออกมาต่างหากใน
 * lib/data/settings.server.ts) getCategories()/getPublishedResearchStats()
 * ก็ cache เช่นกัน (ดู lib/data/categories.server.ts,
 * lib/data/research.server.ts)
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  const [settings, categories, researchStats] = await Promise.all([
    getPublicHomeSettings(),
    getCategories(),
    getPublishedResearchStats(),
  ]);

  const [latest, popular, shelf] = await Promise.all([
    getLatestResearch(settings.homepageLatestCount),
    getPopularResearch(settings.homepagePopularCount),
    getShelfResearch(SHELF_SIZE),
  ]);

  return (
    <>
      <Hero allCategories={categories} shelf={shelf} />
      <CategorySection categories={categories} countByCategoryId={researchStats.countByCategoryId} />
      <ResearchSection
        title={t("latestTitle")}
        description={t("latestDescription")}
        items={latest}
        categories={categories}
        variant="latest"
      />
      <ResearchSection
        title={t("popularTitle")}
        description={t("popularDescription")}
        items={popular}
        categories={categories}
        variant="popular"
      />
    </>
  );
}

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import CategoryCover from "@/components/research/CategoryCover";
import { hasRealCoverImage } from "@/lib/categoryCover";
import type { Category, ResearchItem } from "@/types/research";

/**
 * รายการลิงก์จริงของทุกเล่มบนชั้น เรนเดอร์จากเซิร์ฟเวอร์เสมอ เป็นทั้ง fallback เมื่อ
 * เปิด 3D ไม่ได้ และเป็นทางเข้าของ screen reader/คีย์บอร์ดเมื่อ 3D ทำงาน
 */
export default function StaticShelfList({
  items,
  categories,
}: {
  items: ResearchItem[];
  categories: Category[];
}) {
  return (
    <ul className="flex h-full items-end gap-4 overflow-x-auto px-4 pt-4 sm:px-6 lg:px-8">
      {items.map((item, index) => (
        <li key={item.id} className="h-full shrink-0">
          <Link
            href={`/research/${item.id}`}
            aria-label={item.titleTh}
            data-shelf-index={index}
            className="relative block aspect-[4/5.6] h-full overflow-hidden rounded-r-md rounded-l-sm shadow-xl shadow-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {hasRealCoverImage(item.coverImage) ? (
              <Image src={item.coverImage} alt="" fill sizes="300px" className="object-cover" />
            ) : (
              <CategoryCover
                category={categories.find((category) => category.id === item.categoryId)}
                title={item.titleTh}
                author={item.researchers.map((researcher) => researcher.name).join(", ")}
                year={item.year}
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

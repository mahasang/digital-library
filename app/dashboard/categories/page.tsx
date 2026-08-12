import type { Metadata } from "next";
import CategoryManager from "@/components/dashboard/CategoryManager";
import { getAllCategoriesForAdmin } from "@/lib/data/categories.server";

export const metadata: Metadata = { title: "จัดการหมวดหมู่" };

export default async function DashboardCategoriesPage() {
  const categories = await getAllCategoriesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการหมวดหมู่</h1>
        <p className="mt-1 text-sm text-gray-500">
          เพิ่ม แก้ไข ปิดใช้งาน และลบหมวดหมู่งานวิจัย รองรับหมวดหมู่หลักและหมวดหมู่ย่อย
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ยังไม่มีหมวดหมู่ในระบบ
        </div>
      ) : (
        <CategoryManager categories={categories} />
      )}
    </div>
  );
}

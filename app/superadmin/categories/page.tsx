import type { Metadata } from "next";
import CategoryOrderManager from "@/components/superadmin/CategoryOrderManager";
import { getAllCategoriesForAdmin } from "@/lib/data/categories.server";

export const metadata: Metadata = { title: "จัดลำดับหมวดหมู่ — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminCategoriesPage() {
  const categories = await getAllCategoriesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดลำดับหมวดหมู่</h1>
        <p className="mt-1 text-sm text-gray-500">
          ลากเพื่อจัดลำดับหมวดหมู่หลัก/ย่อย หรือใช้ปุ่มเลื่อนขึ้น-ลงแทนการลากได้ — ลากหมวดหมู่ย่อย
          ข้ามไปหมวดหมู่หลักอื่น หรือใช้เมนูเลือกหมวดหมู่หลักที่แถวนั้นแทนก็ได้ การเปลี่ยนชื่อ/
          เพิ่ม/ลบหมวดหมู่ยังทำที่{" "}
          <a href="/dashboard/categories" className="text-accent hover:underline">
            /dashboard/categories
          </a>{" "}
          เหมือนเดิม
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ยังไม่มีหมวดหมู่ในระบบ
        </div>
      ) : (
        <CategoryOrderManager categories={categories} />
      )}
    </div>
  );
}

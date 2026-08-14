import type { Metadata } from "next";
import OrganizationManager from "@/components/dashboard/OrganizationManager";
import { getAllOrganizationsForAdmin } from "@/lib/data/organizations.server";

export const metadata: Metadata = { title: "จัดการหน่วยงาน" };

export default async function DashboardOrganizationsPage() {
  const organizations = await getAllOrganizationsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการหน่วยงาน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เพิ่ม แก้ไข ปิดใช้งาน และลบหน่วยงานที่เผยแพร่งานวิจัย
        </p>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ยังไม่มีหน่วยงานในระบบ
        </div>
      ) : (
        <OrganizationManager organizations={organizations} />
      )}
    </div>
  );
}

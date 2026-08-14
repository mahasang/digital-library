import type { Metadata } from "next";
import Link from "next/link";
import OrganizationOrderManager from "@/components/superadmin/OrganizationOrderManager";
import { getAllOrganizationsForAdmin } from "@/lib/data/organizations.server";

export const metadata: Metadata = { title: "จัดลำดับหน่วยงาน — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminOrganizationsPage() {
  const organizations = await getAllOrganizationsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดลำดับหน่วยงาน</h1>
        <p className="mt-1 text-sm text-gray-500">
          ลากเพื่อจัดลำดับหน่วยงาน หรือใช้ปุ่มเลื่อนขึ้น-ลงแทนการลากได้ ลำดับนี้มีผลกับตัวเลือก
          หน่วยงานในฟอร์มส่งงานวิจัยด้วย — การเปลี่ยนชื่อ/เพิ่ม/ลบหน่วยงานยังทำที่{" "}
          <Link href="/dashboard/organizations" className="text-accent hover:underline">
            /dashboard/organizations
          </Link>{" "}
          เหมือนเดิม
        </p>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ยังไม่มีหน่วยงานในระบบ
        </div>
      ) : (
        <OrganizationOrderManager organizations={organizations} />
      )}
    </div>
  );
}

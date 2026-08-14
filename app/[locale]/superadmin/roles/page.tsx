import type { Metadata } from "next";
import { Info, Crown } from "lucide-react";
import { roleLabels } from "@/lib/labels";
import type { UserRole } from "@/types/research";

export const metadata: Metadata = { title: "บทบาทและสิทธิ์ — Super Admin" };

interface RoleInfo {
  role: UserRole;
  rank: number;
  permissions: string[];
}

const ROLE_MATRIX: RoleInfo[] = [
  {
    role: "member",
    rank: 10,
    permissions: [
      "อ่าน/ดาวน์โหลดงานวิจัยระดับ public และ member_only",
      "บันทึกรายการโปรด",
      "ดูประวัติการอ่านของตัวเอง",
    ],
  },
  {
    role: "staff",
    rank: 20,
    permissions: [
      "สิทธิ์ทั้งหมดของ Member",
      "เข้าถึงงานวิจัยระดับ staff_only",
      "ส่งงานวิจัยเข้าระบบ (/submit-research)",
      "ดูสถานะและแก้ไขงานวิจัยของตัวเอง (/my-submissions)",
    ],
  },
  {
    role: "librarian",
    rank: 30,
    permissions: [
      "สิทธิ์ทั้งหมดของ Staff",
      "ดูงานวิจัยทุกสถานะเพื่อตรวจสอบ",
      "อนุมัติ/ปฏิเสธ/ขอแก้ไข/เผยแพร่/เก็บถาวรงานวิจัย (/dashboard/approvals)",
      "จัดการงานวิจัยทุกรายการ (/dashboard/research)",
      "จัดการหมวดหมู่และหน่วยงาน",
      "ดูรายงานสถิติ (/dashboard/reports)",
    ],
  },
  {
    role: "admin",
    rank: 40,
    permissions: [
      "สิทธิ์ทั้งหมดของ Librarian",
      "จัดการผู้ใช้และบทบาท Member/Staff/Librarian/Admin (/dashboard/users)",
      "เปิด/ระงับบัญชีผู้ใช้",
      "ดู Audit Log ทั้งหมด (/dashboard/audit-logs)",
      "แก้ไขการตั้งค่าระบบพื้นฐาน (/dashboard/settings)",
    ],
  },
  {
    role: "super_admin",
    rank: 50,
    permissions: [
      "สิทธิ์ทั้งหมดของ Admin",
      "เข้าถึง Super Admin Dashboard (/superadmin) ทั้งหมด — Admin ปกติเข้าไม่ได้",
      "มอบ/ถอดถอนบทบาท Super Admin ให้ผู้ใช้อื่น (ต้องมีเหลืออย่างน้อย 1 คนเสมอ)",
      "แก้ไขลำดับชั้นบทบาท (ตาราง roles) โดยตรง",
      "แก้ไขการตั้งค่าระบบขั้นสูง (การสมัครสมาชิก/ส่งงานวิจัย, ขนาดไฟล์, ความปลอดภัย, การแจ้งเตือน)",
      "จัดการพื้นที่ Storage และลบไฟล์ค้าง",
    ],
  },
];

export default function SuperAdminRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">บทบาทและสิทธิ์</h1>
        <p className="mt-1 text-sm text-gray-500">
          ภาพรวมบทบาททั้ง 5 ระดับในระบบและสิทธิ์หลักของแต่ละบทบาท
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          ระบบนี้ใช้สิทธิ์แบบลำดับชั้นตัวเลข (rank) — บทบาทที่มี rank สูงกว่าจะได้สิทธิ์ทุกอย่าง
          ของบทบาท rank ต่ำกว่าโดยอัตโนมัติเสมอ หน้านี้แสดงผลแบบอ่านอย่างเดียว
          เนื่องจากระบบยังไม่รองรับการกำหนดสิทธิ์แบบละเอียดรายรายการ (fine-grained permissions)
          — การแก้ไขค่า rank ตรงๆ มีความเสี่ยงสูงที่จะทำให้ลำดับชั้นสิทธิ์ทั้งระบบผิดพลาด
          จึงไม่เปิดให้แก้ไขจากหน้านี้
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ROLE_MATRIX.map((info) => (
          <section
            key={info.role}
            className="rounded-xl border border-gray-200 bg-surface p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              {info.role === "super_admin" && <Crown className="h-4 w-4 text-amber-600" />}
              <h2 className="text-sm font-semibold text-gray-900">{roleLabels[info.role]}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                rank {info.rank}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {info.permissions.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

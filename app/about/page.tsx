import type { Metadata } from "next";
import {
  BookOpen,
  Search,
  ShieldCheck,
  Users,
  FileCheck2,
  BarChart3,
} from "lucide-react";
import Container from "@/components/ui/Container";
import { roleLabels } from "@/lib/labels";
import type { UserRole } from "@/types/research";

export const metadata: Metadata = {
  title: "เกี่ยวกับเรา",
  description:
    "ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร แหล่งรวมองค์ความรู้และผลงานวิจัยเพื่อการค้นคว้า",
};

const features = [
  {
    icon: Search,
    title: "ค้นหาได้ง่าย",
    description: "ค้นหางานวิจัยจากชื่อเรื่อง ผู้วิจัย หรือคำสำคัญได้อย่างรวดเร็ว",
  },
  {
    icon: BookOpen,
    title: "อ่านออนไลน์",
    description: "เปิดอ่านเอกสารผ่านเว็บเบราว์เซอร์ได้ทันทีโดยไม่ต้องดาวน์โหลด",
  },
  {
    icon: ShieldCheck,
    title: "จัดการสิทธิ์การเข้าถึง",
    description: "กำหนดระดับการเข้าถึงเอกสารตามความเหมาะสมของแต่ละกลุ่มผู้ใช้",
  },
  {
    icon: FileCheck2,
    title: "กระบวนการตรวจสอบ",
    description: "งานวิจัยทุกชิ้นผ่านการตรวจสอบและอนุมัติก่อนเผยแพร่จริง",
  },
  {
    icon: Users,
    title: "รองรับหลายบทบาท",
    description: "ออกแบบมาให้รองรับผู้ใช้งานหลายระดับตั้งแต่ผู้เยี่ยมชมถึงผู้ดูแลระบบ",
  },
  {
    icon: BarChart3,
    title: "ข้อมูลเชิงสถิติ",
    description: "ติดตามยอดเข้าชมและดาวน์โหลดของงานวิจัยแต่ละรายการ",
  },
];

const roles: { role: UserRole; description: string }[] = [
  { role: "guest", description: "เข้าชมงานวิจัยสาธารณะและดูข้อมูลเบื้องต้นได้โดยไม่ต้องเข้าสู่ระบบ" },
  { role: "member", description: "อ่านและดาวน์โหลดงานวิจัยระดับสมาชิก พร้อมบันทึกรายการโปรด" },
  { role: "staff", description: "เข้าถึงงานวิจัยระดับบุคลากร และส่งงานวิจัยเข้าสู่ระบบได้" },
  { role: "librarian", description: "ตรวจสอบ อนุมัติ หรือขอแก้ไขงานวิจัยที่ถูกส่งเข้ามา" },
  { role: "admin", description: "ดูแลระบบ จัดการผู้ใช้ หมวดหมู่ และรายงานภาพรวมทั้งหมด" },
];

export default function AboutPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            เกี่ยวกับห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
            แพลตฟอร์มกลางสำหรับรวบรวมและเผยแพร่ผลงานวิจัย บทความวิชาการ
            และเอกสาร eBook ที่ผลิตโดยบุคลากรและหน่วยงานภายในองค์กร
            เพื่อส่งเสริมการเข้าถึงองค์ความรู้ ต่อยอดงานวิจัย
            และสนับสนุนการตัดสินใจเชิงนโยบายด้วยข้อมูลที่น่าเชื่อถือ
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {description}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-xl font-bold text-gray-900">
            ระดับสิทธิ์ผู้ใช้งาน
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            ระบบรองรับผู้ใช้งาน 5 ระดับ แต่ละระดับมีสิทธิ์การเข้าถึงที่แตกต่างกัน
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">บทบาท</th>
                  <th className="px-4 py-3 font-medium">คำอธิบาย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map(({ role, description }) => (
                  <tr key={role}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                      {roleLabels[role]}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </div>
  );
}

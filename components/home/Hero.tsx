import { BookMarked, FileText, Users2 } from "lucide-react";
import Container from "@/components/ui/Container";
import HomeSearchBox from "@/components/home/HomeSearchBox";

/**
 * Hallmark — homepage data-flow optimization: เดิม Hero ดึงข้อมูลของตัวเอง
 * (getPublishedResearch/getCategories/getOrganizations/getSettings) แยกจาก
 * app/page.tsx โดยสิ้นเชิง ทำให้ query ซ้ำซ้อนกับที่หน้าแรกดึงไปแล้ว ตอนนี้
 * รับค่าที่คำนวณแล้วเป็น props แทน — ไม่มีการดึงข้อมูลในคอมโพเนนต์นี้อีกต่อไป
 * (จึงไม่ต้องเป็น async component แล้วด้วย) หน้าตา/ข้อความที่แสดงเหมือนเดิม
 * ทุกประการ
 */
export default function Hero({
  siteName,
  publishedCount,
  categoryCount,
  organizationCount,
}: {
  siteName: string;
  publishedCount: number;
  categoryCount: number;
  organizationCount: number;
}) {
  const stats = [
    { icon: FileText, label: "งานวิจัยที่เผยแพร่", value: `${publishedCount}+` },
    { icon: BookMarked, label: "หมวดหมู่งานวิจัย", value: `${categoryCount}` },
    { icon: Users2, label: "หน่วยงานที่ร่วมเผยแพร่", value: `${organizationCount}` },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-brand-900">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_15%_15%,white,transparent_35%),radial-gradient(circle_at_85%_0%,white,transparent_30%)]"
      />
      <Container className="relative flex flex-col items-center gap-7 py-16 text-center sm:py-20">
        <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-brand-100 ring-1 ring-inset ring-white/15">
          {siteName}
        </span>
        <h1 className="max-w-3xl text-h1 font-semibold leading-tight text-white sm:text-display">
          ค้นคว้าและเผยแพร่งานวิจัยขององค์กร
          <br className="hidden sm:block" />
          ในรูปแบบดิจิทัล ทุกที่ ทุกเวลา
        </h1>
        <p className="max-w-2xl text-sm text-brand-100/80 sm:text-base">
          รวบรวมงานวิจัย บทความวิชาการ และเอกสาร eBook จากบุคลากรและหน่วยงานภายในองค์กร
          พร้อมระบบค้นหา อ่านออนไลน์ และดาวน์โหลดตามสิทธิ์การเข้าถึง
        </p>

        <div className="w-full max-w-2xl">
          <HomeSearchBox />
        </div>

        <dl className="grid w-full max-w-2xl grid-cols-3 gap-4 pt-2">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-4 ring-1 ring-inset ring-white/10"
            >
              <dd className="text-lg font-bold text-white sm:text-xl">{value}</dd>
              <dt className="flex items-center gap-1 text-[11px] text-brand-100/70 sm:text-xs">
                <Icon className="h-3.5 w-3.5 text-brand-200" aria-hidden="true" />
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

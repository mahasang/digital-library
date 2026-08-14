import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import Container from "@/components/ui/Container";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "ช่องทางการติดต่อทีมงานห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
};

const infoItems = [
  {
    icon: MapPin,
    title: "ที่อยู่",
    detail: "อาคารห้องสมุดกลาง มหาวิทยาลัยเทคโนโลยีองค์กร กรุงเทพมหานคร 10400",
  },
  {
    icon: Phone,
    title: "โทรศัพท์",
    detail: "02-000-0000 ต่อ 1234",
  },
  {
    icon: Mail,
    title: "อีเมล",
    detail: "library@example.org",
  },
  {
    icon: Clock,
    title: "เวลาทำการ",
    detail: "จันทร์ - ศุกร์ 08:30 - 16:30 น.",
  },
];

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            ติดต่อเรา
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            มีข้อสงสัย ต้องการเสนอแนะ หรือต้องการส่งงานวิจัยเข้าสู่ระบบ
            สามารถติดต่อทีมงานห้องสมุดดิจิทัลได้ตามช่องทางด้านล่าง
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-4">
            {infoItems.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              ส่งข้อความถึงเรา
            </h2>
            <ContactForm />
          </div>
        </div>
      </Container>
    </div>
  );
}

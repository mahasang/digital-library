import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock, Globe, Facebook, MessageCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "ຕິດຕໍ່ເຮົາ",
  description: "ຊ່ອງທາງຕິດຕໍ່ທີມງານຫ້ອງສະໝຸດດິຈິຕອນ",
};

const contactItems = [
  {
    icon: Mail,
    title: "ອີເມວ",
    detail: "info@digitallibrary.la",
    href: "mailto:info@digitallibrary.la",
  },
  {
    icon: Phone,
    title: "ໂທລະສັບ",
    detail: "+856 20 XXXX XXXX",
    href: "tel:+85620XXXXXXXX",
  },
  {
    icon: Globe,
    title: "ເວັບໄຊ",
    detail: "digital-library-sls.vercel.app",
    href: "https://digital-library-sls.vercel.app",
  },
  {
    icon: Facebook,
    title: "Facebook",
    detail: "Digital Library Lao",
    href: "https://facebook.com",
  },
  {
    icon: MessageCircle,
    title: "LINE",
    detail: "@digitallibrary",
    href: "https://line.me",
  },
];

const hours = [
  { day: "ຈັນ – ສຸກ", time: "08:00 – 17:00" },
  { day: "ເສົາ",       time: "08:00 – 12:00" },
  { day: "ອາທິດ",     time: "ປິດ" },
];

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            ຕິດຕໍ່ເຮົາ
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            ມີຄຳຖາມ ຫຼື ຕ້ອງການຊ່ວຍເຫຼືອ? ຕິດຕໍ່ທີມງານຫ້ອງສະໝຸດດິຈິຕອນໄດ້ທາງຊ່ອງທາງດ້ານລຸ່ມ
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1fr_1.3fr]">

          {/* ── ฝั่งซ้าย: ข้อมูลติดต่อ ── */}
          <div className="flex flex-col gap-6">

            {/* ช่องทางติดต่อ */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                ຊ່ອງທາງຕິດຕໍ່
              </h2>
              <div className="flex flex-col gap-2">
                {contactItems.map(({ icon: Icon, title, detail, href }) => (
                  <a
                    key={title}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{detail}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* เวลาทำการ */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                ເວລາເຮັດວຽກ
              </h2>
              <div className="rounded-xl border border-gray-200 bg-surface overflow-hidden">
                {hours.map(({ day, time }, i) => (
                  <div
                    key={day}
                    className={`flex items-center gap-3 p-4 ${i < hours.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                      <Clock className="h-5 w-5" />
                    </span>
                    <p className="flex-1 text-sm font-semibold text-gray-900">{day}</p>
                    <p className={`text-sm ${time === "ປິດ" ? "text-red-500 font-medium" : "text-gray-500"}`}>
                      {time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ที่ตั้ง / Map */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                ທີ່ຕັ້ງ
              </h2>
              <a
                href="https://maps.google.com/?q=Vientiane,Laos"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-gray-200 bg-surface overflow-hidden transition-colors hover:border-blue-200"
              >
                {/* Map placeholder */}
                <div className="flex h-32 items-center justify-center bg-blue-50">
                  <MapPin className="h-12 w-12 text-blue-400" />
                </div>
                <div className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">ວຽງຈັນ, ສປປ ລາວ</p>
                    <p className="mt-0.5 text-sm text-blue-600">ເປີດໃນແຜນທີ່ →</p>
                  </div>
                </div>
              </a>
            </div>

          </div>

          {/* ── ฝั่งขวา: Contact Form ── */}
          <div className="rounded-xl border border-gray-200 bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              ສົ່ງຂໍ້ຄວາມຫາເຮົາ
            </h2>
            <ContactForm />
          </div>

        </div>
      </Container>
    </div>
  );
}

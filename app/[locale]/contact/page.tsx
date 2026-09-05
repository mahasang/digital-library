import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import { Mail, Phone, Clock, MapPin, Facebook } from "lucide-react";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "ຕິດຕໍ່ຫາເຮົາ",
  description: "ມີຄຳຖາມຫຼືຕ້ອງການຊ່ວຍເຫຼືອ? ສົ່ງຂໍ້ຄວາມຫາທີມງານຂອງເຮົາໄດ້ເລີຍ",
};

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* ── Hero + Form ── */}
        <div className="mx-auto max-w-2xl rounded-2xl bg-gray-50 p-8 sm:p-12">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              ຕິດຕໍ່ຫາເຮົາ
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              ມີຄຳຖາມຫຼືຕ້ອງການຊ່ວຍເຫຼືອ? ສົ່ງຂໍ້ຄວາມຫາເຮົາໄດ້ເລີຍ
            </p>
          </div>
          <ContactForm />
        </div>

        {/* ── 3 Cards ── */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <Mail className="h-5 w-5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">ອີເມວ</h3>
            <p className="mt-1 text-sm text-gray-500">ສົ່ງອີເມວຫາທີມງານຂອງເຮົາ</p>
            <a href="mailto:info@digitallibrary.la" className="mt-4 inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              info@digitallibrary.la
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <Phone className="h-5 w-5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">ໂທລະສັບ</h3>
            <p className="mt-1 text-sm text-gray-500">ໂທຫາທີມງານຂອງເຮົາ</p>
            <a href="tel:+85620XXXXXXXX" className="mt-4 inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              +856 20 XXXX XXXX
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <Facebook className="h-5 w-5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Facebook</h3>
            <p className="mt-1 text-sm text-gray-500">ຕິດຕາມຫາເຮົາໃນ Facebook</p>
            <a href="https://facebook.com/digitallibrary.la" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              @digitallibrary.la
            </a>
          </div>
        </div>

        {/* ── Info section ── */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-brand-600 p-8 text-white">
            <MapPin className="h-8 w-8 mb-4 opacity-80" />
            <h3 className="text-lg font-bold mb-2">ທີ່ຕັ້ງ</h3>
            <p className="text-sm opacity-85">ວຽງຈັນ, ສປປ ລາວ</p>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8">
            <Clock className="h-8 w-8 mb-4 text-brand-600" />
            <h3 className="text-lg font-bold text-gray-900 mb-3">ເວລາເຮັດວຽກ</h3>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>ຈັນ – ສຸກ</span>
                <span className="font-medium">08:00 – 17:00</span>
              </div>
              <div className="flex justify-between">
                <span>ເສົາ</span>
                <span className="font-medium">08:00 – 12:00</span>
              </div>
              <div className="flex justify-between">
                <span>ອາທິດ</span>
                <span className="text-red-500 font-medium">ປິດ</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
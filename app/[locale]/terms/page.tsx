import type { Metadata } from "next";
import Container from "@/components/ui/Container";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "ເງື່ອນໄຂການໃຊ້ງານ | Terms of Service" };
}

export default async function TermsPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            ເງື່ອນໄຂການໃຊ້ງານ
          </h1>
          <div className="space-y-6 text-gray-600">
            <p className="text-sm text-gray-400">ອັບເດດລ່າສຸດ: ກັນຍາ 2026</p>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. ການຍອມຮັບເງື່ອນໄຂ</h2>
              <p className="text-sm leading-relaxed">ການໃຊ້ງານຫ້ອງສະໝຸດດິຈິຕອນ ຖືວ່າທ່ານໄດ້ຍອມຮັບເງື່ອນໄຂການໃຊ້ງານເຫຼົ່ານີ້ທັງໝົດ</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. ການໃຊ້ງານທີ່ຍອມຮັບໄດ້</h2>
              <p className="text-sm leading-relaxed mb-2">ທ່ານຕົກລົງທີ່ຈະ:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>ໃຊ້ງານເພື່ອຈຸດປະສົງດ້ານການສຶກສາ ແລະ ການຄົ້ນຄວ້າ</li>
                <li>ບໍ່ທຳການ copy ຫຼື ເຜີຍແຜ່ເນື້ອຫາໂດຍບໍ່ໄດ້ຮັບອະນຸຍາດ</li>
                <li>ບໍ່ໃຊ້ລະບົບເພື່ອຈຸດປະສົງທີ່ຜິດກົດໝາຍ</li>
                <li>ຮັກສາຄວາມປອດໄພຂອງບັນຊີຂອງທ່ານ</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. ລິຂະສິດ</h2>
              <p className="text-sm leading-relaxed">ເນື້ອຫາທັງໝົດໃນຫ້ອງສະໝຸດດິຈິຕອນ ແມ່ນຊັບສິນທາງປັນຍາຂອງຜູ້ຂຽນ ແລະ ໜ່ວຍງານທີ່ກ່ຽວຂ້ອງ ການຄັດລອກ ຫຼື ເຜີຍແຜ່ໂດຍບໍ່ໄດ້ຮັບອະນຸຍາດຖືວ່າຜິດກົດໝາຍ</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. ຄວາມຮັບຜິດຊອບ</h2>
              <p className="text-sm leading-relaxed">ຫ້ອງສະໝຸດດິຈິຕອນບໍ່ຮັບຜິດຊອບຕໍ່ຄວາມເສຍຫາຍທີ່ເກີດຈາກການໃຊ້ງານ ຫຼື ຄວາມບໍ່ຖືກຕ້ອງຂອງຂໍ້ມູນ</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. ການປ່ຽນແປງເງື່ອນໄຂ</h2>
              <p className="text-sm leading-relaxed">ເຮົາຂໍສະຫງວນສິດໃນການປ່ຽນແປງເງື່ອນໄຂເຫຼົ່ານີ້ໄດ້ທຸກເວລາ ການໃຊ້ງານຕໍ່ເນື່ອງຖືວ່າທ່ານຍອມຮັບການປ່ຽນແປງດັ່ງກ່າວ</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. ຕິດຕໍ່</h2>
              <p className="text-sm leading-relaxed">
                ຫາກມີຄຳຖາມກ່ຽວກັບເງື່ອນໄຂເຫຼົ່ານີ້ ກະລຸນາຕິດຕໍ່:{" "}
                <a href="mailto:info@digitallibrary.la" className="text-brand-600 hover:underline">
                  info@digitallibrary.la
                </a>
              </p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}

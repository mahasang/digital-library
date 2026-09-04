import Container from "@/components/ui/Container";

export async function generateMetadata() {
  return { title: "ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ | Privacy Policy" };
}

export default async function PrivacyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ
          </h1>
          <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
            <p className="text-sm text-gray-400">ອັບເດດລ່າສຸດ: ກັນຍາ 2026</p>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">1. ຂໍ້ມູນທີ່ເກັບກຳ</h2>
              <p>ຫ້ອງສະໝຸດດິຈິຕອນເກັບກຳຂໍ້ມູນດັ່ງຕໍ່ໄປນີ້:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>ຊື່ ແລະ ທີ່ຢູ່ອີເມວ ເມື່ອທ່ານສ້າງບັນຊີ</li>
                <li>ປະຫວັດການອ່ານ ແລະ ລາຍການທີ່ມັກ</li>
                <li>ຄຳເຫັນ ແລະ ຄະແນນທີ່ທ່ານໃຫ້</li>
                <li>ຂໍ້ມູນການໃຊ້ງານ (ຈຳນວນການເຂົ້າເບິ່ງ)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">2. ການໃຊ້ຂໍ້ມູນ</h2>
              <p>ເຮົາໃຊ້ຂໍ້ມູນຂອງທ່ານເພື່ອ:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>ໃຫ້ບໍລິການຫ້ອງສະໝຸດດິຈິຕອນ</li>
                <li>ສົ່ງການແຈ້ງເຕືອນກ່ຽວກັບງານວິໄຈໃໝ່</li>
                <li>ປັບປຸງປະສົບການໃຊ້ງານ</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">3. ການແບ່ງປັນຂໍ້ມູນ</h2>
              <p>ເຮົາບໍ່ຂາຍ ຫຼື ແບ່ງປັນຂໍ້ມູນສ່ວນຕົວຂອງທ່ານໃຫ້ກັບບຸກຄົນທີສາມ ຍົກເວັ້ນເພື່ອການໃຫ້ບໍລິການ (Supabase, Google)</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">4. ຄວາມປອດໄພ</h2>
              <p>ຂໍ້ມູນຂອງທ່ານຖືກເກັບຮັກສາຢ່າງປອດໄພດ້ວຍ Supabase ແລະ ການເຂົ້າລະຫັດ SSL</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">5. ສິດຂອງຜູ້ໃຊ້</h2>
              <p>ທ່ານມີສິດ:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>ເຂົ້າເຖິງຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ</li>
                <li>ແກ້ໄຂ ຫຼື ລຶບຂໍ້ມູນຂອງທ່ານ</li>
                <li>ຍົກເລີກການສະໝັກຮັບການແຈ້ງເຕືອນ</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">6. ຕິດຕໍ່</h2>
              <p>ຫາກມີຄຳຖາມ ກະລຸນາຕິດຕໍ່: <a href="mailto:info@digitallibrary.la" className="text-brand-600 hover:underline">info@digitallibrary.la</a></p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}

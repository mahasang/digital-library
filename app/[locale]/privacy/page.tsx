export const dynamic = "force-dynamic";
import { getTranslations } from "next-intl/server";
import Container from "@/components/ui/Container";

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("title")}
          </h1>
          <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
            <p className="text-sm text-gray-400">{t("lastUpdated")}</p>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section1.title")}</h2>
              <p>{t("section1.intro")}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t("section1.item1")}</li>
                <li>{t("section1.item2")}</li>
                <li>{t("section1.item3")}</li>
                <li>{t("section1.item4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section2.title")}</h2>
              <p>{t("section2.intro")}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t("section2.item1")}</li>
                <li>{t("section2.item2")}</li>
                <li>{t("section2.item3")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section3.title")}</h2>
              <p>{t("section3.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section4.title")}</h2>
              <p>{t("section4.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section5.title")}</h2>
              <p>{t("section5.intro")}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t("section5.item1")}</li>
                <li>{t("section5.item2")}</li>
                <li>{t("section5.item3")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900">{t("section6.title")}</h2>
              <p>{t("section6.content")} <a href="mailto:info@digitallibrary.la" className="text-brand-600 hover:underline">info@digitallibrary.la</a></p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}

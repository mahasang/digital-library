export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Container from "@/components/ui/Container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("title")}
          </h1>
          <div className="space-y-6 text-gray-600">
            <p className="text-sm text-gray-400">{t("lastUpdated")}</p>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section1.title")}</h2>
              <p className="text-sm leading-relaxed">{t("section1.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section2.title")}</h2>
              <p className="text-sm leading-relaxed mb-2">{t("section2.intro")}</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>{t("section2.item1")}</li>
                <li>{t("section2.item2")}</li>
                <li>{t("section2.item3")}</li>
                <li>{t("section2.item4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section3.title")}</h2>
              <p className="text-sm leading-relaxed">{t("section3.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section4.title")}</h2>
              <p className="text-sm leading-relaxed">{t("section4.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section5.title")}</h2>
              <p className="text-sm leading-relaxed">{t("section5.content")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("section6.title")}</h2>
              <p className="text-sm leading-relaxed">
                {t("section6.content")}{" "}
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

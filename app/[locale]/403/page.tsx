import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "errors" });
  return { title: t("forbiddenTitle") };
}

export default async function ForbiddenPage() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <Container className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-bold text-gray-900">{t("forbiddenHeading")}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t("forbiddenBody")}
        </p>
        <div className="mt-6 flex gap-3">
          <LinkButton href="/" variant="primary">
            {t("backHome")}
          </LinkButton>
          <LinkButton href="/account" variant="outline">
            {t("myProfile")}
          </LinkButton>
        </div>
      </Container>
    </div>
  );
}

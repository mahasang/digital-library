"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookOpen, Mail, MapPin, Phone } from "lucide-react";
import Container from "@/components/ui/Container";
import type { AppSettings, Category } from "@/types/research";

export default function Footer({
  settings,
  categories,
}: {
  settings: AppSettings;
  categories: Category[];
}) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <Container className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-gray-900">{settings.siteName}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-500">
            {t("tagline")}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t("researchCategories")}</h2>
          <ul className="mt-3 space-y-2">
            {categories.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/research?category=${c.id}`}
                  className="text-sm text-gray-500 hover:text-brand-700"
                >
                  {c.nameTh}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t("quickLinks")}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/research" className="text-sm text-gray-500 hover:text-brand-700">
                {t("browseResearch")}
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-sm text-gray-500 hover:text-brand-700">
                {t("about")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-sm text-gray-500 hover:text-brand-700">
                {t("contact")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-brand-700">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-brand-700">
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/register" className="text-sm text-gray-500 hover:text-brand-700">
                {t("register")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t("contact")}</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-gray-500">
            {settings.contactAddress && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{settings.contactAddress}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{settings.contactPhone}</span>
              </li>
            )}
            {settings.contactEmail && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{settings.contactEmail}</span>
              </li>
            )}
          </ul>
        </div>
      </Container>
      <div className="border-t border-gray-200 py-4">
        <Container>
          <p className="text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {settings.siteName} {settings.copyrightText}
          </p>
        </Container>
      </div>
    </footer>
  );
}

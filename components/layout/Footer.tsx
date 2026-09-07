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
    <footer className="bg-[#0f1f3d] text-white">
      {/* ── top accent ── */}
      <div className="h-0.5 bg-brand-400" />

      <Container className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* ── Brand ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-600">
              <BookOpen className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold tracking-tight text-white">
              {settings.siteName}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            {t("tagline")}
          </p>
        </div>

        {/* ── Categories ── */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2">
            {t("researchCategories")}
          </h2>
          <ul className="space-y-2">
            {categories.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/research?category=${c.id}`}
                  className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  <span className="h-1 w-1 rounded-full bg-brand-400 shrink-0" />
                  {c.nameTh}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Quick links ── */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2">
            {t("quickLinks")}
          </h2>
          <ul className="space-y-2">
            {[
              { href: "/research", label: t("browseResearch") },
              { href: "/blog",     label: t("contact") === "ຕິດຕໍ່ເຮົາ" ? "ບົດຄວາມ" : "Blog" },
              { href: "/about",    label: t("about") },
              { href: "/contact",  label: t("contact") },
              { href: "/privacy",  label: t("privacy") },
              { href: "/terms",    label: t("terms") },
              { href: "/register", label: t("register") },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  <span className="h-1 w-1 rounded-full bg-brand-400 shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Contact ── */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2">
            {t("contact")}
          </h2>
          <ul className="space-y-3 text-sm text-slate-300">
            {settings.contactAddress && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span>{settings.contactAddress}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-brand-400" />
                <span>{settings.contactPhone}</span>
              </li>
            )}
            {settings.contactEmail && (
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-brand-400" />
                <span>{settings.contactEmail}</span>
              </li>
            )}
          </ul>
        </div>
      </Container>

      {/* ── Bottom bar ── */}
      <div className="border-t border-white/10 py-4">
        <Container className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {settings.siteName} {settings.copyrightText}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-500 hover:text-white transition-colors">
              {t("privacyPolicy")}
            </Link>
            <Link href="/terms" className="text-xs text-slate-500 hover:text-white transition-colors">
              {t("termsOfService")}
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
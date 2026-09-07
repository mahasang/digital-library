"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, X, Search, BookOpen } from "lucide-react";
import Container from "@/components/ui/Container";
import { SettingsDropdown } from "@/components/layout/SettingsDropdown";

export default function Header({
  desktopAccountArea,
  mobileAccountArea,
  siteName,
  logoUrl,
}: {
  desktopAccountArea: ReactNode;
  mobileAccountArea: ReactNode;
  siteName?: string;
  logoUrl?: string;
}) {
  const t = useTranslations("nav");
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/" as const,        label: t("home") },
    { href: "/research" as const, label: t("research") },
    { href: "/blog" as const,    label: t("blog") },
    { href: "/about" as const,   label: t("about") },
    { href: "/contact" as const, label: t("contact") },
  ];

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-surface shadow-sm">
      {/* ── top accent bar ── */}
      <div className="h-0.5 bg-brand-900" />

      <Container>
        <div className="flex h-14 items-center justify-between gap-4">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={32}
                height={32}
                priority
                className="h-8 w-8 rounded-sm object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-900 text-white">
                <BookOpen className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </span>
            )}
            <span className="hidden text-sm font-bold tracking-tight text-gray-900 sm:block max-w-[200px] line-clamp-1">
              {siteName ?? tHeader("siteName")}
            </span>
          </Link>

          {/* ── Desktop nav ── */}
          <nav aria-label={tHeader("mainMenu")} className="hidden items-center md:flex">
            {navLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                    active
                      ? "text-brand-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Desktop right ── */}
          <div className="hidden items-center gap-2 md:flex">
            <SettingsDropdown />
            <Link
              href="/research"
              aria-label={tHeader("searchResearch")}
              className="rounded-sm p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Search className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </Link>
            {desktopAccountArea}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            type="button"
            className="rounded-sm p-2 text-gray-600 hover:bg-gray-100 md:hidden transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? tHeader("closeMenu") : tHeader("openMenu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* ── Mobile menu ── */}
      {open && (
        <div className="border-t border-gray-200 bg-surface md:hidden">
          <Container className="flex flex-col py-2">
            <div className="px-3 py-2">
              <SettingsDropdown />
            </div>
            {navLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium transition-colors border-l-2 ${
                    active
                      ? "border-brand-600 text-brand-600 bg-brand-50"
                      : "border-transparent text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {mobileAccountArea}
          </Container>
        </div>
      )}
    </header>
  );
}
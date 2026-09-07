import { BookMarked, FileText, Users2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container from "@/components/ui/Container";
import HomeSearchBox from "@/components/home/HomeSearchBox";

export default async function Hero({
  siteName,
  publishedCount,
  categoryCount,
  organizationCount,
}: {
  siteName: string;
  publishedCount: number;
  categoryCount: number;
  organizationCount: number;
}) {
  const t = await getTranslations("home");
  const stats = [
    { icon: FileText,    label: t("statPublished"),     value: `${publishedCount}+` },
    { icon: BookMarked,  label: t("statCategories"),    value: `${categoryCount}` },
    { icon: Users2,      label: t("statOrganizations"), value: `${organizationCount}` },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0f1f3d]">
      {/* ── decorative grid lines ── */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      {/* ── accent line top ── */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent" />

      <Container className="relative flex flex-col items-center gap-8 py-16 text-center sm:py-24">
        {/* ── institution badge ── */}
        <div className="flex items-center gap-2 rounded-sm border border-brand-400/30 bg-brand-400/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          <span className="text-xs font-medium tracking-widest text-brand-200 uppercase">
            {siteName}
          </span>
        </div>

        {/* ── heading ── */}
        <div className="flex flex-col gap-3">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl tracking-tight">
            {t("heroHeadingLine1")}
            <span className="block text-brand-300 mt-1">{t("heroHeadingLine2")}</span>
          </h1>
          <p className="max-w-xl text-sm text-slate-400 sm:text-base leading-relaxed">
            {t("heroSubtitle")}
          </p>
        </div>

        {/* ── search ── */}
        <div className="w-full max-w-2xl">
          <HomeSearchBox />
        </div>

        {/* ── stats ── */}
        <dl className="flex w-full max-w-2xl flex-col divide-y divide-white/10 rounded-sm border border-white/10 bg-white/[0.03] sm:flex-row sm:divide-x sm:divide-y-0">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-1 items-center gap-4 px-6 py-4 sm:flex-col sm:items-center sm:gap-2 sm:py-5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-brand-400/30 bg-brand-400/10">
                <Icon className="h-4 w-4 text-brand-300" aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:items-center">
                <dd className="text-2xl font-bold text-white sm:text-3xl">{value}</dd>
                <dt className="text-[11px] text-slate-400 uppercase tracking-wider sm:text-xs">
                  {label}
                </dt>
              </div>
            </div>
          ))}
        </dl>
      </Container>

      {/* ── bottom fade ── */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
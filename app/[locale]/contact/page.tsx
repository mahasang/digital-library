import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import ContactForm from './ContactForm';
import ContactMap from './ContactMap';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default function ContactPage() {
  const t = useTranslations('contact');

  return (
    <main className="min-h-screen py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-h1 font-semibold text-ink mb-2">
          {t('heading')}
        </h1>
        <p className="text-ink-soft max-w-md mx-auto">
          {t('subheading')}
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Map + Info */}
        <div className="flex flex-col gap-4">
          <ContactMap />
          <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col gap-4 shadow-elevated-sm">
            <InfoRow label={t('info.address')} value={t('info.addressValue')} />
            <InfoRow label={t('info.email')} value={t('info.emailValue')} isEmail />
            <InfoRow label={t('info.phone')} value={t('info.phoneValue')} />
            <InfoRow label={t('info.hours')} value={t('info.hoursValue')} />
          </div>
        </div>

        {/* Right: Form */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-elevated-sm">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  isEmail,
}: {
  label: string;
  value: string;
  isEmail?: boolean;
}) {
  return (
    <div>
      <p className="text-caption text-ink-faint uppercase tracking-wider mb-1">
        {label}
      </p>
      {isEmail ? (
        <a
          href={`mailto:${value}`}
          className="text-body-sm font-medium text-accent hover:text-accent-strong hover:underline transition-colors"
        >
          {value}
        </a>
      ) : (
        <p className="text-body-sm font-medium text-ink">{value}</p>
      )}
    </div>
  );
}

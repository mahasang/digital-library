'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
}

export default function ContactForm() {
  const t = useTranslations('contact.form');
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-2xl">
          ✓
        </div>
        <p className="font-medium text-ink">{t('successTitle')}</p>
        <p className="text-body-sm text-ink-soft">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t('firstName')}
          name="firstName"
          value={form.firstName}
          placeholder={t('firstNamePlaceholder')}
          onChange={handleChange}
          required
        />
        <Field
          label={t('lastName')}
          name="lastName"
          value={form.lastName}
          placeholder={t('lastNamePlaceholder')}
          onChange={handleChange}
          required
        />
      </div>

      <Field
        label={t('email')}
        name="email"
        type="email"
        value={form.email}
        placeholder={t('emailPlaceholder')}
        onChange={handleChange}
        required
      />

      {/* Phone with country code prefix */}
      <div>
        <label className="block text-body-sm text-ink-soft mb-1">
          {t('phone')}
        </label>
        <div className="flex rounded-lg border border-border overflow-hidden bg-surface focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-colors">
          <span className="px-3 py-2 text-body-sm border-r border-border bg-surface-muted text-ink-faint select-none">
            +856
          </span>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder={t('phonePlaceholder')}
            className="flex-1 px-3 py-2 text-body-sm bg-transparent text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-body-sm text-ink-soft mb-1">
          {t('message')}
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          placeholder={t('messagePlaceholder')}
          rows={5}
          required
          className="w-full rounded-lg border border-border bg-surface text-ink placeholder:text-ink-faint px-3 py-2 text-body-sm outline-none resize-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="self-start rounded-lg bg-accent text-white px-6 py-2 text-body-sm font-medium hover:bg-accent-strong disabled:opacity-60 transition-colors"
      >
        {status === 'sending' ? t('sending') : t('submit')}
      </button>

      {status === 'error' && (
        <p className="text-body-sm text-danger">{t('error')}</p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  value,
  placeholder,
  onChange,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-body-sm text-ink-soft mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg border border-border bg-surface text-ink placeholder:text-ink-faint px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      />
    </div>
  );
}

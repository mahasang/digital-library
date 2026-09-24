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
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      // ส่งผ่าน Resend (ที่ใช้อยู่แล้วใน project)
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
      <div className="flex flex-col items-center justify-center h-full py-12 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 text-2xl">
          ✓
        </div>
        <p className="font-medium">{t('successTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('successBody')}</p>
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

      <div>
        <label className="block text-sm text-muted-foreground mb-1">
          {t('phone')}
        </label>
        <div className="flex rounded-lg border overflow-hidden bg-background">
          <span className="px-3 py-2 text-sm border-r bg-muted text-muted-foreground">
            +856
          </span>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder={t('phonePlaceholder')}
            className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">
          {t('message')}
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          placeholder={t('messagePlaceholder')}
          rows={5}
          required
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="self-start rounded-lg bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {status === 'sending' ? t('sending') : t('submit')}
      </button>

      {status === 'error' && (
        <p className="text-sm text-destructive">{t('error')}</p>
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
      <label htmlFor={name} className="block text-sm text-muted-foreground mb-1">
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
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
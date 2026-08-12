"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-sm font-semibold text-green-800">
          ส่งข้อความเรียบร้อยแล้ว (ตัวอย่างการทำงาน)
        </p>
        <p className="text-xs text-green-700">
          หน้านี้ยังไม่เชื่อมต่อระบบส่งอีเมลจริง ข้อมูลของคุณจะไม่ถูกบันทึก
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-2 text-xs font-medium text-green-800 underline underline-offset-2"
        >
          ส่งข้อความอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            ชื่อ-นามสกุล
          </label>
          <input
            id="name"
            required
            type="text"
            placeholder="กรอกชื่อของคุณ"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            อีเมล
          </label>
          <input
            id="email"
            required
            type="email"
            placeholder="you@example.com"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="subject" className="text-sm font-medium text-gray-700">
          หัวข้อ
        </label>
        <input
          id="subject"
          required
          type="text"
          placeholder="หัวข้อที่ต้องการติดต่อ"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium text-gray-700">
          ข้อความ
        </label>
        <textarea
          id="message"
          required
          rows={5}
          placeholder="รายละเอียดที่ต้องการสอบถามหรือแจ้งเรา"
          className="resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <Send className="h-4 w-4" />
        ส่งข้อความ
      </button>
    </form>
  );
}

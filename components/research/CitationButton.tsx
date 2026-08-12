"use client";

import { useState } from "react";
import { Quote, Check, Copy } from "lucide-react";
import type { ResearchItem } from "@/types/research";

type CitationSource = Pick<ResearchItem, "titleTh" | "researchers" | "organization" | "year">;

/** จัดรูปแบบข้อความอ้างอิงอย่างง่ายจากข้อมูลที่แสดงอยู่บนหน้านี้แล้ว —
 * ไม่มีการเรียก API หรือ business logic ใหม่ใดๆ ทั้งสิ้น */
function buildCitation(item: CitationSource): string {
  const authors = item.researchers.map((r) => r.name).join(", ");
  const authorPart = authors || item.organization;
  return `${authorPart}. (${item.year}). ${item.titleTh}. ${item.organization}.`;
}

export default function CitationButton({ item }: { item: CitationSource }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const citation = buildCitation(item);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API อาจใช้ไม่ได้ในบางบริบท (เช่นไม่ใช่ HTTPS) — ผู้ใช้ยังคัดลอก
      // ข้อความที่แสดงไว้ในกล่องได้เองด้วยการเลือกข้อความตามปกติ
    }
  }

  return (
    <div className="relative flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <Quote className="h-3.5 w-3.5" />
        อ้างอิง
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-surface p-3 shadow-elevated-md sm:w-80">
            <p className="text-xs leading-relaxed text-gray-600">{citation}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "คัดลอกแล้ว" : "คัดลอกข้อความอ้างอิง"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

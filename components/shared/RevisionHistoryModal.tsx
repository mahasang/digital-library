"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { ContentRevision } from "@/lib/data/revisions.server";

interface RevisionHistoryModalProps {
  revisions: ContentRevision[];
}

/**
 * แสดงรายการ snapshot ของ blog post/research item ก่อนแก้ไขแต่ละครั้ง
 * (view-only — ไม่มี restore/rollback) รับ `revisions` เป็น prop ที่หน้า Server
 * Component ดึงมาให้แล้ว (ผ่าน getRevisions() ใน lib/data/revisions.server.ts)
 * แทนการดึงเองตอนเปิด modal — ฟังก์ชันนั้นมี `import "server-only"` จึง import
 * ตรงเข้า Client Component แบบนี้ไม่ได้อยู่แล้ว
 */
export function RevisionHistoryModal({ revisions }: RevisionHistoryModalProps) {
  const t = useTranslations("revisionHistory");
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ContentRevision | null>(null);

  function close() {
    setIsOpen(false);
    setSelected(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {t("buttonLabel")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-4xl flex-col rounded-lg bg-surface shadow-xl max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-900">{t("title")}</h2>
              <button
                type="button"
                onClick={close}
                aria-label={t("title")}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 shrink-0 overflow-y-auto border-r border-gray-200">
                {revisions.length === 0 && (
                  <p className="p-4 text-sm text-gray-500">{t("noRevisions")}</p>
                )}
                {revisions.map((rev) => (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelected(rev)}
                    className={`block w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50 ${
                      selected?.id === rev.id ? "bg-gray-50" : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(rev.createdAt).toLocaleString(locale)}
                    </div>
                    <div className="text-xs text-gray-500">{rev.actorName ?? t("unknownActor")}</div>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selected ? (
                  <SnapshotView revision={selected} />
                ) : (
                  <p className="text-sm text-gray-500">{t("selectVersion")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** แสดง field ของ snapshot แบบ key-value ล้วนๆ (ไม่มี diff — ดู
 * prompt_revision_history_inspect.md: เลือก full snapshot มากกว่า diff
 * เพราะฟิลด์ที่ localized มีจำนวนมาก) key ที่ขึ้นต้นด้วย `_` คือ relation ที่ผูก
 * เพิ่มเข้ามาตอน snapshot (เช่น _authors/_categories/_keywords) แยกแสดงจาก
 * scalar field ปกติของแถวหลัก */
function SnapshotView({ revision }: { revision: ContentRevision }) {
  const snap = revision.snapshot;
  const scalarEntries = Object.entries(snap).filter(([key]) => !key.startsWith("_"));
  const relationEntries = Object.entries(snap).filter(([key]) => key.startsWith("_"));

  return (
    <dl className="space-y-3 text-sm">
      {scalarEntries.map(([key, value]) => (
        <div key={key}>
          <dt className="font-medium text-gray-500">{key}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-gray-900">
            {value === null || value === undefined
              ? ""
              : typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value)}
          </dd>
        </div>
      ))}
      {relationEntries.map(([key, value]) => (
        <div key={key}>
          <dt className="font-medium text-gray-500">{key.slice(1)}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-gray-900">
            {JSON.stringify(value, null, 2)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

import Image from "next/image";
import {
  AlertTriangle,
  Calendar,
  FileText,
  Paperclip,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import AccessBadge from "@/components/research/AccessBadge";
import StatusBadge from "@/components/research/StatusBadge";
import { getCategoryById } from "@/lib/data/categories.server";
import type { ApprovalLogEntry, SubmissionItem } from "@/types/research";
import { statusLabels, scanStatusLabels } from "@/lib/labels";

const SCAN_STATUS_BADGE_TONE = {
  pending: "amber",
  clean: "green",
  infected: "red",
  error: "red",
  skipped: "amber",
} as const;

export default async function SubmissionDetailView({
  item,
  logs,
  documentUrl,
  attachmentUrl,
}: {
  item: SubmissionItem;
  logs: ApprovalLogEntry[];
  documentUrl?: string | null;
  attachmentUrl?: string | null;
}) {
  const category = await getCategoryById(item.categoryId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-[4/5.6] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          {item.coverImage ? (
            <Image
              src={item.coverImage}
              alt={`ปกงานวิจัย: ${item.titleTh}`}
              fill
              sizes="220px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <FileText className="h-10 w-10" />
            </div>
          )}
        </div>

        {documentUrl && (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            ดูไฟล์ PDF
          </a>
        )}
        {attachmentUrl && (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Paperclip className="h-4 w-4" />
            ดูไฟล์แนบ
          </a>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <AccessBadge accessLevel={item.accessLevel} />
            {category && <Badge tone="brand">{category.nameTh}</Badge>}
          </div>
          <h1 className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
            {item.titleTh}
          </h1>
          {item.titleEn && (
            <p className="mt-1.5 text-sm italic text-gray-500">{item.titleEn}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-surface p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-accent" />
            ผู้วิจัย
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {item.researchers.map((r, i) => (
              <li key={`${r.name}-${i}`} className="text-sm text-gray-600">
                {r.name}
                {r.organization && (
                  <span className="text-gray-500"> — {r.organization}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5" />
            ปี {item.year} · {item.organization}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">บทคัดย่อ</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {item.abstract}
          </p>
        </div>

        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Tag className="h-4 w-4 text-accent" />
            คำสำคัญ
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.keywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
              >
                #{kw}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-surface p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {item.scanStatus === "clean" ? (
              <ShieldCheck className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            การตรวจสอบไฟล์
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={SCAN_STATUS_BADGE_TONE[item.scanStatus]}>
              {scanStatusLabels[item.scanStatus]}
            </Badge>
            {item.scanProvider && (
              <span className="text-xs text-gray-500">ผู้ให้บริการ: {item.scanProvider}</span>
            )}
          </div>
          {item.scanReason && (
            <p className="mt-1.5 text-xs text-gray-500">{item.scanReason}</p>
          )}
        </div>

        {item.copyrightNote && (
          <div className="rounded-xl border border-gray-200 bg-surface p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <ShieldCheck className="h-4 w-4 text-accent" />
              ข้อมูลลิขสิทธิ์
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-600">
              {item.copyrightNote}
            </p>
          </div>
        )}

        {item.reviewNote && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">หมายเหตุจากผู้ตรวจสอบล่าสุด</p>
            <p className="mt-1 text-amber-800">{item.reviewNote}</p>
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">ประวัติการเปลี่ยนสถานะ</h2>
            <ol className="flex flex-col gap-3 border-l-2 border-gray-200 pl-4">
              {logs.map((log) => (
                <li key={log.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="font-medium text-gray-900">
                    {log.fromStatus ? `${statusLabels[log.fromStatus]} → ` : ""}
                    {statusLabels[log.toStatus]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {log.note && <p className="mt-1 text-xs text-gray-600">{log.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

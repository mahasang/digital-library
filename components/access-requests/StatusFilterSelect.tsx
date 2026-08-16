"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AccessRequestStatus } from "@/types/research";

const STATUS_VALUES: AccessRequestStatus[] = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "more_information_required",
  "cancelled",
  "expired",
];

export default function StatusFilterSelect({
  basePath,
  currentStatus,
}: {
  basePath: string;
  currentStatus: AccessRequestStatus | "";
}) {
  const router = useRouter();
  const tStatuses = useTranslations("accessRequestStatuses");

  return (
    <select
      value={currentStatus}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value ? `${basePath}?status=${value}` : basePath);
      }}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="">ทุกสถานะ</option>
      {STATUS_VALUES.map((status) => (
        <option key={status} value={status}>
          {tStatuses(status)}
        </option>
      ))}
    </select>
  );
}

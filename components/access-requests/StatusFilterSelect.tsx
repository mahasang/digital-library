"use client";

import { useRouter } from "next/navigation";
import { accessRequestStatusLabels } from "@/lib/labels";
import type { AccessRequestStatus } from "@/types/research";

export default function StatusFilterSelect({
  basePath,
  currentStatus,
}: {
  basePath: string;
  currentStatus: AccessRequestStatus | "";
}) {
  const router = useRouter();

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
      {(Object.keys(accessRequestStatusLabels) as AccessRequestStatus[]).map((status) => (
        <option key={status} value={status}>
          {accessRequestStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useTransition } from "react";
import { updateContactMessageStatusAction, type ContactMessageStatus } from "./actions";

const STATUS_LABEL: Record<ContactMessageStatus, string> = {
  unread:  "ຍັງບໍ່ໄດ້ອ່ານ",
  read:    "ອ່ານແລ້ວ",
  replied: "ຕອບແລ້ວ",
};

export default function StatusUpdater({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: ContactMessageStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ContactMessageStatus;
    startTransition(async () => {
      await updateContactMessageStatusAction(id, next);
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="h-fit shrink-0 rounded-lg border border-gray-200 bg-surface px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      aria-label="ປ່ຽນສະຖານະ"
    >
      {(Object.keys(STATUS_LABEL) as ContactMessageStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
  );
}
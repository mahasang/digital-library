"use client";

import { useActionState, useRef } from "react";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import { deleteOrphanedFileAction } from "@/app/[locale]/superadmin/storage/actions";
import { idleActionResult } from "@/lib/actions/types";
import { formatFileSize } from "@/lib/storage/limits";
import type { OrphanedFile } from "@/lib/data/superadmin-stats.server";

export default function OrphanedFileRow({
  bucketId,
  file,
}: {
  bucketId: string;
  file: OrphanedFile;
}) {
  const [state, formAction, pending] = useActionState(deleteOrphanedFileAction, idleActionResult);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-gray-700" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.sizeBytes)} · อัปโหลดเมื่อ{" "}
            {new Date(file.createdAt).toLocaleDateString("th-TH")}
          </p>
        </div>
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`ยืนยันลบไฟล์นี้ถาวร?\n\n${file.name}`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="bucketId" value={bucketId} />
          <input type="hidden" name="path" value={file.name} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            ลบ
          </button>
        </form>
      </div>
      {state.status === "error" && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
    </li>
  );
}

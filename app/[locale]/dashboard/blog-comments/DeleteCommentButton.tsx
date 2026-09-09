"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBlogCommentAction } from "./actions";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("ທ່ານຕ້ອງການລຶບຄຳເຫັນນີ້ບໍ?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBlogCommentAction(commentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        ລຶບ
      </button>
    </div>
  );
}

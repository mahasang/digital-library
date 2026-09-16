"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBlogPostAction } from "@/app/[locale]/blog-admin/actions";

export default function DeletePostButton({
  postId,
  postTitle,
}: {
  postId: string;
  postTitle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("blogAdmin.deleteButton");

  function handleDelete() {
    if (!confirm(t("confirmMessage", { title: postTitle }))) return;
    startTransition(async () => {
      await deleteBlogPostAction(postId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
      title={t("title")}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

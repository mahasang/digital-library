"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

  function handleDelete() {
    if (!confirm(`ທ່ານຕ້ອງການລຶບ «${postTitle}» ບໍ? ບໍ່ສາມາດກູ້ຄືນໄດ້`)) return;
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
      title="ລົບ"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

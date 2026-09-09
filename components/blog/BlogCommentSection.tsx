"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare, Send, Loader2, Trash2, Pencil } from "lucide-react";
import {
  addBlogCommentAction,
  deleteBlogCommentAction,
  updateBlogCommentAction,
} from "@/app/[locale]/blog/[slug]/actions";

type BlogComment = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
  user_id: string;
  author_name: string;
  author_avatar_url: string | null;
};

type Props = {
  blogPostId: string;
  initialComments: BlogComment[];
  currentUserId: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ເມື່ອກີ້";
  if (mins < 60) return `${mins} ນາທີ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ຊົ່ວໂມງ`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ວັນ`;
  return new Date(dateStr).toLocaleDateString("lo-LA");
}

export function BlogCommentSection({
  blogPostId,
  initialComments,
  currentUserId,
}: Props) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const router = useRouter();

  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (!newText.trim()) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await addBlogCommentAction(blogPostId, newText, locale);
      if (result.error) {
        setSubmitError(result.error);
      } else {
        setNewText("");
        router.refresh();
      }
    });
  }

  async function handleDelete(commentId: string) {
    if (!confirm(t("comment_delete_confirm"))) return;
    setDeleteLoading(commentId);
    await deleteBlogCommentAction(commentId, locale);
    setDeleteLoading(null);
    router.refresh();
  }

  async function handleUpdate(commentId: string) {
    if (!editingText.trim()) return;
    await updateBlogCommentAction(commentId, editingText, locale);
    setEditingId(null);
    setEditingText("");
    router.refresh();
  }

  return (
    <section
      aria-label={t("comment_section_label")}
      className="mt-10 border-t border-gray-200 dark:border-gray-800 pt-8"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare
          className="h-5 w-5 text-brand-600"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {t("comment_title")}
          {initialComments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({initialComments.length})
            </span>
          )}
        </h2>
      </div>

      {/* Input area */}
      <div className="mb-8">
        {currentUserId ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("comment_placeholder")}
              className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition"
              aria-label={t("comment_placeholder")}
            />
            {submitError && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {submitError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!newText.trim() || isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {t("comment_submit")}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("comment_login_prompt")}{" "}
            <a
              href={`/${locale}/login`}
              className="text-brand-600 hover:underline font-medium"
            >
              {t("comment_login_link")}
            </a>
          </p>
        )}
      </div>

      {/* Comment list */}
      {initialComments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          {t("comment_empty")}
        </p>
      ) : (
        <ul
          className="space-y-4"
          aria-label={t("comment_list_label")}
        >
          {initialComments.map((c) => {
            const isOwner = currentUserId === c.user_id;
            const isEditing = editingId === c.id;
            const initials = c.author_name.slice(0, 2).toUpperCase();

            return (
              <li key={c.id} className="flex gap-3">
                {/* Avatar */}
                <div
                  className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 shrink-0 overflow-hidden"
                  aria-hidden="true"
                >
                  {c.author_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.author_avatar_url}
                      alt=""
                      className="h-9 w-9 object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl rounded-tl-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3">
                    {/* Comment header */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {c.author_name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <time
                          dateTime={c.created_at}
                          className="text-xs text-gray-400 dark:text-gray-500"
                        >
                          {timeAgo(c.created_at)}
                        </time>
                        {isOwner && !isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditingText(c.content);
                              }}
                              className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                              aria-label={t("comment_edit")}
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              disabled={deleteLoading === c.id}
                              className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              aria-label={t("comment_delete")}
                            >
                              {deleteLoading === c.id ? (
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Content or edit form */}
                    {isEditing ? (
                      <div className="flex flex-col gap-2 mt-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={2}
                          maxLength={1000}
                          autoFocus
                          className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-500 focus:outline-none"
                          aria-label={t("comment_edit_label")}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingText("");
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            {t("comment_cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(c.id)}
                            disabled={!editingText.trim()}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                          >
                            {t("comment_save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {c.content}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

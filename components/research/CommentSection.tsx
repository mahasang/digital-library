"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  addCommentAction,
  deleteCommentAction,
  updateCommentAction,
  type CommentRow,
} from "@/app/[locale]/research/[id]/actions";
import { createClient } from "@/lib/supabase/client";

export default function CommentSection({
  researchId,
  initialComments,
  isLoggedIn,
}: {
  researchId: string;
  initialComments: CommentRow[];
  isLoggedIn: boolean;
}) {
  const t = useTranslations("research.detail.comments");
  const tCommon = useTranslations("common");
  const router = useRouter();
  // ใช้ prop ตรงๆ ไม่ copy ใส่ useState — router.refresh() ทำให้ page.tsx
  // (Server Component) ดึง comments ใหม่แล้วส่ง prop ใหม่ลงมาอยู่แล้ว ถ้า copy
  // ใส่ useState ค่าจะค้างที่ initial mount เท่านั้น ไม่มีวันอัปเดตตาม prop ใหม่
  // (useState ไม่ re-init เองตอน prop เปลี่ยน) ต่างจาก key/remount ที่จะรีเซ็ต
  const comments = initialComments;
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ดึง user id ปัจจุบันฝั่ง client เอง (ไม่รับเป็น prop จาก page.tsx) เพราะ
  // scope ของงานนี้จำกัดไว้แค่ CommentSection.tsx/actions.ts เท่านั้น — การ
  // เพิ่ม prop ใหม่จะต้องแก้ page.tsx (ผู้เรียก) ด้วยเสมอ ซึ่งอยู่นอก scope
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!isLoggedIn) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [isLoggedIn]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditPending, startEditTransition] = useTransition();

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t("today");
    if (days < 30) return `${days} ${t("daysAgoUnit")}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${t("monthsAgoUnit")}`;
    return `${Math.floor(months / 12)} ${t("yearsAgoUnit")}`;
  }

  function handleSubmit() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addCommentAction(researchId, text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  function startEditing(comment: CommentRow) {
    setEditingId(comment.id);
    setEditingText(comment.content);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingText("");
    setEditError(null);
  }

  function handleUpdate(commentId: string) {
    if (!editingText.trim()) return;
    setEditError(null);
    startEditTransition(async () => {
      const result = await updateCommentAction(commentId, editingText);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      setEditingId(null);
      setEditingText("");
      router.refresh();
    });
  }

  function handleDelete(commentId: string) {
    if (!confirm(t("deleteConfirm"))) return;
    setEditError(null);
    startEditTransition(async () => {
      const result = await deleteCommentAction(commentId);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("title", { count: comments.length })}
      </h3>

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isLoggedIn ? t("placeholder") : t("loginPlaceholder")}
          disabled={!isLoggedIn || isPending}
          rows={2}
          maxLength={500}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || !isLoggedIn || isPending}
          className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => {
            const authorName = c.authorName || t("defaultAuthorName");
            const initials = authorName.slice(0, 2).toUpperCase();
            const isOwner = currentUserId !== null && currentUserId === c.userId;
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="flex gap-3">
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {c.authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar อาจมาจากหลาย host ต่างกัน (Supabase Storage/Google OAuth) ไม่ผูกกับ remotePatterns เดียว
                    <img
                      src={c.authorAvatarUrl}
                      alt={authorName}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                {/* Bubble */}
                <div className="flex-1 rounded-xl rounded-tl-sm bg-gray-100 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-700">{authorName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                      {isOwner && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(c)}
                            aria-label={t("edit")}
                            className="text-gray-400 transition-colors hover:text-brand-600"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            disabled={isEditPending}
                            aria-label={t("delete")}
                            className="text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        maxLength={500}
                        autoFocus
                        disabled={isEditPending}
                        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      {editError && <p className="text-xs text-red-600">{editError}</p>}
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={isEditPending}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {tCommon("cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(c.id)}
                          disabled={isEditPending || !editingText.trim()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          {isEditPending && <Loader2 className="h-3 w-3 animate-spin" />}
                          {tCommon("save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">{c.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

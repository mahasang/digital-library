"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertBlogPostAction, type BlogFormState } from "./actions";
import type { BlogPost } from "@/lib/data/blog.server";

const initialState: BlogFormState = { status: "idle" };

export default function BlogPostForm({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const [publishValue, setPublishValue] = useState(
    post?.status === "published" ? "true" : "false"
  );

  const action = upsertBlogPostAction.bind(null, post?.id ?? null);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/dashboard/blog");
    }
  }, [state, router]);

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50";
  const textareaCls = `${inputCls} resize-none`;
  const labelCls = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="publish" value={publishValue} />

      {/* ── Slug ── */}
      <div>
        <label className={labelCls}>Slug (URL) *</label>
        <input
          name="slug"
          type="text"
          defaultValue={post?.slug ?? ""}
          placeholder="my-blog-post"
          required
          disabled={isPending}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">ໃຊ້ສະເພາະ a-z, 0-9, -</p>
      </div>

      {/* ── Cover image ── */}
      <div>
        <label className={labelCls}>URL ຮູບປົກ</label>
        <input
          name="cover_image"
          type="url"
          defaultValue={post?.coverImage ?? ""}
          placeholder="https://..."
          disabled={isPending}
          className={inputCls}
        />
      </div>

      {/* ── Titles ── */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">ຫົວຂໍ້</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { name: "title_lo", label: "ລາວ", value: post?.titleLo },
            { name: "title_th", label: "ໄທ", value: post?.titleTh },
            { name: "title_en", label: "ອັງກິດ", value: post?.titleEn },
            { name: "title_vi", label: "ຫວຽດນາມ", value: post?.titleVi },
          ].map(({ name, label, value }) => (
            <div key={name}>
              <label className={labelCls}>{label}</label>
              <input name={name} type="text" defaultValue={value ?? ""} disabled={isPending} className={inputCls} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Excerpts ── */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">ຫຍໍ້ຄວາມ</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { name: "excerpt_lo", label: "ລາວ", value: post?.excerptLo },
            { name: "excerpt_th", label: "ໄທ", value: post?.excerptTh },
            { name: "excerpt_en", label: "ອັງກິດ", value: post?.excerptEn },
            { name: "excerpt_vi", label: "ຫວຽດນາມ", value: post?.excerptVi },
          ].map(({ name, label, value }) => (
            <div key={name}>
              <label className={labelCls}>{label}</label>
              <textarea name={name} rows={2} defaultValue={value ?? ""} disabled={isPending} className={textareaCls} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Contents ── */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">ເນື້ອຫາ (Markdown)</p>
        <div className="flex flex-col gap-3">
          {[
            { name: "content_lo", label: "ລາວ", value: post?.contentLo },
            { name: "content_th", label: "ໄທ", value: post?.contentTh },
            { name: "content_en", label: "ອັງກິດ", value: post?.contentEn },
            { name: "content_vi", label: "ຫວຽດນາມ", value: post?.contentVi },
          ].map(({ name, label, value }) => (
            <div key={name}>
              <label className={labelCls}>{label}</label>
              <textarea name={name} rows={8} defaultValue={value ?? ""} disabled={isPending} className={`${textareaCls} font-mono text-xs`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.message}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          onClick={() => setPublishValue("false")}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຮ່າງ"}
        </button>
        <button
          type="submit"
          disabled={isPending}
          onClick={() => setPublishValue("true")}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "ກຳລັງບັນທຶກ..." : "ເຜີຍແຜ່"}
        </button>
      </div>
    </form>
  );
}
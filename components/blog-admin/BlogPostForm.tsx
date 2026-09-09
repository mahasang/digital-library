"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Globe } from "lucide-react";
import { upsertBlogPostAction, uploadCoverImageAction, type BlogFormState } from "@/app/[locale]/blog-admin/actions";
import type { BlogPost } from "@/lib/data/blog.server";
import TipTapEditor from "./TipTapEditor";

const LANGS = [
  { key: "lo", label: "ລາວ", flag: "🇱🇦" },
  { key: "th", label: "ໄທ", flag: "🇹🇭" },
  { key: "en", label: "ອັງກິດ", flag: "🇬🇧" },
  { key: "vi", label: "ຫວຽດນາມ", flag: "🇻🇳" },
] as const;

type Lang = typeof LANGS[number]["key"];

const initialState: BlogFormState = { status: "idle" };

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  function addTag(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = input.trim().toLowerCase().replace(/\s+/g, "-");
      if (tag && !tags.includes(tag)) onChange([...tags, tag]);
      setInput("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600">
            #{tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-brand-400 hover:text-brand-700">×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addTag}
        placeholder="ພິມ tag ແລ້ວກົດ Enter..."
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
      />
      <p className="text-xs text-gray-400">กด Enter หรือ , เพื่อเพิ่ม tag</p>
    </div>
  );
}

export default function BlogPostForm({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const action = upsertBlogPostAction.bind(null, post?.id ?? null);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [activeLang, setActiveLang] = useState<Lang>("lo");
  const [publishValue, setPublishValue] = useState(post?.status === "published" ? "true" : "false");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TipTap content per lang
  const [contents, setContents] = useState({
    lo: post?.contentLo ?? "",
    th: post?.contentTh ?? "",
    en: post?.contentEn ?? "",
    vi: post?.contentVi ?? "",
  });

  useEffect(() => {
    if (state.status === "success") router.push("/lo/blog-admin");
  }, [state, router]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadCoverImageAction(fd);
    setUploading(false);
    if (result.url) setCoverImage(result.url);
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="publish" value={publishValue} />
      <input type="hidden" name="cover_image" value={coverImage} />
      {LANGS.map(({ key }) => (
        <input key={key} type="hidden" name={`content_${key}`} value={contents[key]} />
      ))}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Main ── */}
        <div className="flex flex-col gap-5">

          {/* Slug */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Slug (URL) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="text-sm text-gray-400">/blog/</span>
              <input
                name="slug"
                type="text"
                defaultValue={post?.slug ?? ""}
                placeholder="my-post-slug"
                required
                disabled={isPending}
                className="flex-1 border-0 bg-transparent text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">ໃຊ້ a-z, 0-9, - ເທົ່ານັ້ນ</p>
          </div>

          {/* Lang tabs */}
          <div>
            <div className="mb-3 flex gap-1 border-b border-gray-200">
              {LANGS.map(({ key, label, flag }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveLang(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeLang === key
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span>{flag}</span>
                  {label}
                </button>
              ))}
            </div>

            {LANGS.map(({ key }) => (
              <div key={key} className={activeLang === key ? "flex flex-col gap-3" : "hidden"}>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600 uppercase tracking-wide">ຫົວຂໍ້</label>
                  <input
                    name={`title_${key}`}
                    type="text"
                    defaultValue={post?.[`title${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof BlogPost] as string ?? ""}
                    disabled={isPending}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600 uppercase tracking-wide">ຫຍໍ້ຄວາມ</label>
                  <textarea
                    name={`excerpt_${key}`}
                    rows={2}
                    defaultValue={post?.[`excerpt${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof BlogPost] as string ?? ""}
                    disabled={isPending}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600 uppercase tracking-wide">ເນື້ອຫາ</label>
                  <TipTapEditor
                    content={contents[key]}
                    onChange={(html) => setContents((prev) => ({ ...prev, [key]: html }))}
                    placeholder={`ຂຽນເນື້ອຫາ (${key})...`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="flex flex-col gap-4">

          {/* Publish actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">ການເຜີຍແຜ່</p>
            {state.status === "error" && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.message}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isPending}
                onClick={() => setPublishValue("false")}
                className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isPending ? "ກຳລັງບັນທຶກ..." : "💾 ບັນທຶກຮ່າງ"}
              </button>
              <button
                type="submit"
                disabled={isPending}
                onClick={() => setPublishValue("true")}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "ກຳລັງບັນທຶກ..." : "🚀 ເຜີຍແຜ່"}
              </button>
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-gray-900">⏰ ກຳນົດເວລາ</p>
            <input
              type="datetime-local"
              name="scheduled_at"
              className={`${inputCls} text-xs`}
            />
            <p className="mt-1 text-xs text-gray-400">ຖ້າວ່າງ ຈະເຜີຍແຜ່ທັນທີ</p>
          </div>

          {/* Cover image */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-gray-900">🖼 ຮູບໜ້າປົກ</p>
            {coverImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="cover" className="w-full rounded-lg object-cover aspect-video" />
                <button
                  type="button"
                  onClick={() => setCoverImage("")}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-4 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "ກຳລັງອັບໂຫລດ..." : "ອັບໂຫລດຮູບ"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">ຫຼື</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <input
                  type="text"
                  placeholder="https://..."
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className={`${inputCls} text-xs`}
                />
              </div>
            )}
          </div>
          {/* Tags */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-gray-900">🏷 Tags</p>
            <TagInput
              tags={tags}
              onChange={setTags}
            />
            <input type="hidden" name="tags" value={JSON.stringify(tags)} />
          </div>
        </div>
      </div>
    </form>
  );
}
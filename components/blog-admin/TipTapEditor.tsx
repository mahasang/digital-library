"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link2, ImageIcon, Undo, Redo,
} from "lucide-react";

export default function TipTapEditor({
  content,
  onChange,
  placeholder = "ຂຽນເນື້ອຫາທີ່ນີ້...",
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[300px] px-4 py-3 focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  const btnCls = (active?: boolean) =>
    `p-1.5 rounded text-sm transition-colors ${
      active
        ? "bg-brand-100 text-brand-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    }`;

  function addImage() {
    const url = window.prompt("URL ຮູບພາບ:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  function addLink() {
    const url = window.prompt("URL ລິ້ງ:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btnCls()} title="Undo"><Undo className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btnCls()} title="Redo"><Redo className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnCls(editor.isActive("heading", { level: 1 }))} title="H1"><Heading1 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnCls(editor.isActive("heading", { level: 2 }))} title="H2"><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnCls(editor.isActive("heading", { level: 3 }))} title="H3"><Heading3 className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnCls(editor.isActive("bold"))} title="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnCls(editor.isActive("italic"))} title="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnCls(editor.isActive("strike"))} title="Strike"><Strikethrough className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={btnCls(editor.isActive("code"))} title="Code"><Code className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnCls(editor.isActive("bulletList"))} title="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnCls(editor.isActive("orderedList"))} title="Ordered list"><ListOrdered className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnCls(editor.isActive("blockquote"))} title="Quote"><Quote className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnCls()} title="Divider"><Minus className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" onClick={addLink} className={btnCls(editor.isActive("link"))} title="Link"><Link2 className="h-4 w-4" /></button>
        <button type="button" onClick={addImage} className={btnCls()} title="Image"><ImageIcon className="h-4 w-4" /></button>
        <div className="ml-auto text-xs text-gray-400">
          {editor.storage.characterCount.characters()} ຕົວ
        </div>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import {
  createCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
  updateCategoryAction,
} from "@/app/dashboard/categories/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AdminCategoryRow } from "@/lib/data/categories.server";

export default function CategoryManager({
  categories,
}: {
  categories: AdminCategoryRow[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มหมวดหมู่
        </button>
      </div>

      {showAddForm && (
        <CategoryForm
          mode="create"
          topLevelOptions={topLevel}
          onDone={() => setShowAddForm(false)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อหมวดหมู่</th>
              <th className="px-4 py-3 font-medium">หมวดหมู่หลัก</th>
              <th className="px-4 py-3 font-medium">งานวิจัย</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((category) =>
              editingId === category.id ? (
                <tr key={category.id}>
                  <td colSpan={5} className="px-4 py-3">
                    <CategoryForm
                      mode="edit"
                      category={category}
                      topLevelOptions={topLevel.filter((c) => c.id !== category.id)}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={() => setEditingId(category.id)}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
}: {
  category: AdminCategoryRow;
  onEdit: () => void;
}) {
  const [toggleState, toggleFormAction, togglePending] = useActionState(
    toggleCategoryActiveAction,
    idleActionResult
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteCategoryAction,
    idleActionResult
  );

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{category.nameTh}</p>
        <p className="text-xs text-gray-500">{category.nameEn}</p>
      </td>
      <td className="px-4 py-3 text-gray-500">{category.parentNameTh || "—"}</td>
      <td className="px-4 py-3 text-gray-500">{category.researchCount}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            category.isActive
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {category.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
          >
            <Pencil className="h-3.5 w-3.5" />
            แก้ไข
          </button>
          <form action={toggleFormAction}>
            <input type="hidden" name="id" value={category.id} />
            <input
              type="hidden"
              name="nextActive"
              value={(!category.isActive).toString()}
            />
            <button
              type="submit"
              disabled={togglePending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            >
              {togglePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
              {category.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </form>
          <form
            action={deleteFormAction}
            onSubmit={(e) => {
              if (!confirm(`ยืนยันลบหมวดหมู่ "${category.nameTh}" ?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deletePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              ลบ
            </button>
          </form>
        </div>
        {toggleState.status === "error" && (
          <p className="mt-1 text-xs text-red-600">{toggleState.message}</p>
        )}
        {deleteState.status === "error" && (
          <p className="mt-1 text-xs text-red-600">{deleteState.message}</p>
        )}
      </td>
    </tr>
  );
}

function CategoryForm({
  mode,
  category,
  topLevelOptions,
  onDone,
}: {
  mode: "create" | "edit";
  category?: AdminCategoryRow;
  topLevelOptions: AdminCategoryRow[];
  onDone: () => void;
}) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction;
  const [state, formAction, isPending] = useActionState(action, idleActionResult);

  useEffect(() => {
    if (state.status === "success") {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-accent-soft p-4"
    >
      {mode === "edit" && category && (
        <input type="hidden" name="id" value={category.id} />
      )}
      {state.status === "error" && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="nameTh"
          required
          defaultValue={category?.nameTh}
          placeholder="ชื่อหมวดหมู่ (ภาษาไทย)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="nameEn"
          required
          defaultValue={category?.nameEn}
          placeholder="ชื่อหมวดหมู่ (ภาษาอังกฤษ)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="description"
          defaultValue={category?.description}
          placeholder="คำอธิบาย (ถ้ามี)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          name="icon"
          defaultValue={category?.icon}
          placeholder="ชื่อไอคอน (เช่น Cog, Cpu, Leaf)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="parentId"
          defaultValue={category?.parentId ?? ""}
          className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ไม่มี (เป็นหมวดหมู่หลัก)</option>
          {topLevelOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.nameTh}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึก
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

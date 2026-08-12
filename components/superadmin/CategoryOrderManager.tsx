"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
} from "lucide-react";
import { moveCategoryAction, reorderCategoriesAction } from "@/app/superadmin/categories/actions";
import type { AdminCategoryRow } from "@/lib/data/categories.server";

const ROOT = "root";

type Containers = Record<string, AdminCategoryRow[]>;

function buildContainers(categories: AdminCategoryRow[]): Containers {
  const containers: Containers = { [ROOT]: [] };
  const topLevel = categories.filter((c) => !c.parentId);
  containers[ROOT] = topLevel;
  for (const top of topLevel) {
    containers[top.id] = categories.filter((c) => c.parentId === top.id);
  }
  return containers;
}

export default function CategoryOrderManager({
  categories,
}: {
  categories: AdminCategoryRow[];
}) {
  const [containers, setContainers] = useState<Containers>(() => buildContainers(categories));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const topLevelIds = useMemo(() => containers[ROOT].map((c) => c.id), [containers]);

  function findContainerOf(itemId: string): string | null {
    for (const [key, items] of Object.entries(containers)) {
      if (items.some((c) => c.id === itemId)) return key;
    }
    return null;
  }

  async function persistReorder(parentKey: string, items: AdminCategoryRow[]) {
    setStatus(null);
    const parentId = parentKey === ROOT ? null : parentKey;
    const result = await reorderCategoriesAction(
      parentId,
      items.map((c) => c.id)
    );
    if (result.status === "error") {
      setStatus({ type: "error", message: result.message });
      setContainers(buildContainers(categories));
    } else {
      setStatus({ type: "success", message: "จัดลำดับหมวดหมู่เรียบร้อยแล้ว" });
    }
  }

  async function persistMove(
    categoryId: string,
    newParentKey: string,
    items: AdminCategoryRow[]
  ) {
    setStatus(null);
    const newParentId = newParentKey === ROOT ? null : newParentKey;
    const result = await moveCategoryAction(
      categoryId,
      newParentId,
      items.map((c) => c.id)
    );
    if (result.status === "error") {
      setStatus({ type: "error", message: result.message });
      setContainers(buildContainers(categories));
    } else {
      setStatus({ type: "success", message: "ย้ายหมวดหมู่เรียบร้อยแล้ว" });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceKey = findContainerOf(activeId);
    if (!sourceKey) return;
    // ปลายทางอาจเป็น id ของรายการ (วางใกล้รายการนั้น) หรือ id ของ container เอง (วางในพื้นที่ว่าง)
    const destKey = findContainerOf(overId) ?? (containers[overId] ? overId : sourceKey);

    if (sourceKey === ROOT && destKey !== ROOT) return; // หมวดหมู่หลักย้ายเป็นหมวดหมู่ย่อยไม่ได้จากมุมมองนี้
    if (destKey === ROOT && sourceKey !== ROOT) return; // หมวดหมู่ย่อยลากขึ้นมาเป็นหมวดหมู่หลักไม่รองรับในมุมมองนี้ (ใช้ dropdown แทน)

    if (sourceKey === destKey) {
      const items = containers[sourceKey];
      const oldIndex = items.findIndex((c) => c.id === activeId);
      const newIndex = items.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      setContainers((prev) => ({ ...prev, [sourceKey]: reordered }));
      startTransition(() => {
        persistReorder(sourceKey, reordered);
      });
      return;
    }

    // ย้ายข้ามหมวดหมู่หลัก (ลากหมวดหมู่ย่อยจากหมวดหมู่หลักหนึ่งไปอีกหมวดหมู่หนึ่ง)
    const sourceItems = containers[sourceKey].filter((c) => c.id !== activeId);
    const moved = containers[sourceKey].find((c) => c.id === activeId);
    if (!moved) return;
    const destItems = containers[destKey];
    const overIndex = destItems.findIndex((c) => c.id === overId);
    const insertAt = overIndex === -1 ? destItems.length : overIndex;
    const newDestItems = [
      ...destItems.slice(0, insertAt),
      moved,
      ...destItems.slice(insertAt),
    ];

    setContainers((prev) => ({
      ...prev,
      [sourceKey]: sourceItems,
      [destKey]: newDestItems,
    }));
    startTransition(() => {
      persistMove(activeId, destKey, newDestItems);
    });
  }

  function moveWithinContainer(containerKey: string, index: number, direction: -1 | 1) {
    const items = containers[containerKey];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = arrayMove(items, index, newIndex);
    setContainers((prev) => ({ ...prev, [containerKey]: reordered }));
    startTransition(() => {
      persistReorder(containerKey, reordered);
    });
  }

  function moveToParentViaSelect(category: AdminCategoryRow, newParentKey: string) {
    const sourceKey = findContainerOf(category.id);
    if (!sourceKey || sourceKey === newParentKey) return;
    const sourceItems = containers[sourceKey].filter((c) => c.id !== category.id);
    const destItems = [...containers[newParentKey], category];

    setContainers((prev) => ({
      ...prev,
      [sourceKey]: sourceItems,
      [newParentKey]: destItems,
    }));
    startTransition(() => {
      persistMove(category.id, newParentKey, destItems);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {status && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {status.message}
        </div>
      )}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          กำลังบันทึก...
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {containers[ROOT].map((top, index) => (
              <TopLevelCard
                key={top.id}
                category={top}
                subcategories={containers[top.id] ?? []}
                topLevelOptions={containers[ROOT]}
                index={index}
                total={containers[ROOT].length}
                onMoveUp={() => moveWithinContainer(ROOT, index, -1)}
                onMoveDown={() => moveWithinContainer(ROOT, index, 1)}
                onChildMoveUp={(childIndex) => moveWithinContainer(top.id, childIndex, -1)}
                onChildMoveDown={(childIndex) => moveWithinContainer(top.id, childIndex, 1)}
                onChildMoveToParent={(child, newParentId) =>
                  moveToParentViaSelect(child, newParentId)
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TopLevelCard({
  category,
  subcategories,
  topLevelOptions,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onChildMoveUp,
  onChildMoveDown,
  onChildMoveToParent,
}: {
  category: AdminCategoryRow;
  subcategories: AdminCategoryRow[];
  topLevelOptions: AdminCategoryRow[];
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChildMoveUp: (childIndex: number) => void;
  onChildMoveDown: (childIndex: number) => void;
  onChildMoveToParent: (child: AdminCategoryRow, newParentId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const { setNodeRef: setDroppableRef } = useDroppable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const childIds = subcategories.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-surface ${isDragging ? "border-brand-400 shadow-lg" : "border-gray-200"}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-500 active:cursor-grabbing"
          aria-label={`ลากเพื่อจัดลำดับ ${category.nameTh}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="เลื่อนขึ้น"
            className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="เลื่อนลง"
            className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{category.nameTh}</p>
          <p className="truncate text-xs text-gray-500">{category.nameEn}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            category.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {category.researchCount} งานวิจัย
        </span>
      </div>

      <div ref={setDroppableRef} className="flex flex-col gap-1.5 p-3">
        {subcategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-3 text-center text-xs text-gray-300">
            ยังไม่มีหมวดหมู่ย่อย — ลากหมวดหมู่ย่อยจากที่อื่นมาวางที่นี่ได้
          </p>
        ) : (
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            {subcategories.map((child, childIndex) => (
              <SubCategoryRow
                key={child.id}
                category={child}
                index={childIndex}
                total={subcategories.length}
                topLevelOptions={topLevelOptions}
                onMoveUp={() => onChildMoveUp(childIndex)}
                onMoveDown={() => onChildMoveDown(childIndex)}
                onMoveToParent={(newParentId) => onChildMoveToParent(child, newParentId)}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function SubCategoryRow({
  category,
  index,
  total,
  topLevelOptions,
  onMoveUp,
  onMoveDown,
  onMoveToParent,
}: {
  category: AdminCategoryRow;
  index: number;
  total: number;
  topLevelOptions: AdminCategoryRow[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToParent: (newParentId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        isDragging ? "border-brand-400 bg-accent-soft shadow" : "border-gray-100 bg-gray-50/50"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-gray-300 hover:bg-surface hover:text-gray-500 active:cursor-grabbing"
        aria-label={`ลากเพื่อจัดลำดับ ${category.nameTh}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="เลื่อนขึ้น"
          className="rounded p-0.5 text-gray-500 hover:bg-surface hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="เลื่อนลง"
          className="rounded p-0.5 text-gray-500 hover:bg-surface hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-800">{category.nameTh}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          category.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {category.researchCount}
      </span>
      <select
        value={category.parentId ?? ""}
        onChange={(e) => e.target.value && onMoveToParent(e.target.value)}
        aria-label={`ย้าย ${category.nameTh} ไปหมวดหมู่หลักอื่น`}
        className="shrink-0 rounded-md border border-gray-200 bg-surface px-1.5 py-1 text-xs text-gray-600"
      >
        {topLevelOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.nameTh}
          </option>
        ))}
      </select>
    </div>
  );
}

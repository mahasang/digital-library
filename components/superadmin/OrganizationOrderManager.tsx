"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, GripVertical, Loader2 } from "lucide-react";
import { reorderOrganizationsAction } from "@/app/superadmin/organizations/actions";
import type { AdminOrganizationRow } from "@/lib/data/organizations.server";

export default function OrganizationOrderManager({
  organizations,
}: {
  organizations: AdminOrganizationRow[];
}) {
  const [items, setItems] = useState<AdminOrganizationRow[]>(organizations);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map((o) => o.id), [items]);

  async function persist(next: AdminOrganizationRow[]) {
    setStatus(null);
    const result = await reorderOrganizationsAction(next.map((o) => o.id));
    if (result.status === "error") {
      setStatus({ type: "error", message: result.message });
      setItems(organizations);
    } else {
      setStatus({ type: "success", message: "จัดลำดับหน่วยงานเรียบร้อยแล้ว" });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((o) => o.id === active.id);
    const newIndex = items.findIndex((o) => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    startTransition(() => {
      persist(reordered);
    });
  }

  function moveByIndex(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = arrayMove(items, index, newIndex);
    setItems(reordered);
    startTransition(() => {
      persist(reordered);
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
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((org, index) => (
              <OrganizationRow
                key={org.id}
                organization={org}
                index={index}
                total={items.length}
                onMoveUp={() => moveByIndex(index, -1)}
                onMoveDown={() => moveByIndex(index, 1)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function OrganizationRow({
  organization,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  organization: AdminOrganizationRow;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: organization.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 ${
        isDragging ? "border-brand-400 shadow-lg" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-500 active:cursor-grabbing"
        aria-label={`ลากเพื่อจัดลำดับ ${organization.nameTh}`}
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
        <p className="truncate text-sm font-semibold text-gray-900">{organization.nameTh}</p>
        <p className="truncate text-xs text-gray-500">{organization.nameEn}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          organization.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {organization.researchCount} งานวิจัย
      </span>
    </div>
  );
}

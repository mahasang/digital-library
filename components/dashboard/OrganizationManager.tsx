"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertTriangle, GitMerge, Loader2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import {
  createOrganizationAction,
  deleteOrganizationAction,
  mergeOrganizationsAction,
  toggleOrganizationActiveAction,
  updateOrganizationAction,
} from "@/app/[locale]/dashboard/organizations/actions";
import { checkSimilarOrganizationsAction } from "@/app/[locale]/dashboard/authors/check-similar-actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AdminOrganizationRow } from "@/lib/data/organizations.server";

export default function OrganizationManager({
  organizations,
}: {
  organizations: AdminOrganizationRow[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);

  // นับความลึกจาก parentId เพื่อแสดงย่อหน้าตามโครงสร้างหลัก/ย่อย (ข้อมูลจาก
  // getAllOrganizationsForAdmin เรียงแบบต้นไม้มาให้แล้ว จึงคำนวณความลึกได้ตรงๆ)
  const depthById = new Map<string, number>();
  for (const org of organizations) {
    const depth = org.parentId ? (depthById.get(org.parentId) ?? 0) + 1 : 0;
    depthById.set(org.id, depth);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มหน่วยงาน
        </button>
      </div>

      {showAddForm && (
        <OrganizationForm mode="create" organizations={organizations} onDone={() => setShowAddForm(false)} />
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อหน่วยงาน</th>
              <th className="px-4 py-3 font-medium">งานวิจัย</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {organizations.map((org) =>
              editingId === org.id ? (
                <tr key={org.id}>
                  <td colSpan={4} className="px-4 py-3">
                    <OrganizationForm
                      mode="edit"
                      organization={org}
                      organizations={organizations}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : mergingId === org.id ? (
                <tr key={org.id}>
                  <td colSpan={4} className="px-4 py-3">
                    <MergeOrganizationForm
                      organization={org}
                      organizations={organizations}
                      onDone={() => setMergingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <OrganizationRow
                  key={org.id}
                  organization={org}
                  depth={depthById.get(org.id) ?? 0}
                  onEdit={() => setEditingId(org.id)}
                  onMerge={() => setMergingId(org.id)}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrganizationRow({
  organization,
  depth,
  onEdit,
  onMerge,
}: {
  organization: AdminOrganizationRow;
  depth: number;
  onEdit: () => void;
  onMerge: () => void;
}) {
  const [toggleState, toggleFormAction, togglePending] = useActionState(
    toggleOrganizationActiveAction,
    idleActionResult
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteOrganizationAction,
    idleActionResult
  );

  return (
    <tr>
      <td className="px-4 py-3" style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
        <p className="font-medium text-gray-900">
          {depth > 0 && <span className="mr-1 text-gray-300">└</span>}
          {organization.nameTh}
        </p>
        {organization.nameEn && <p className="text-xs text-gray-500">{organization.nameEn}</p>}
        {organization.mergedIntoOrganizationId && (
          <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
            ถูกรวมข้อมูลแล้ว
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500">{organization.researchCount}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            organization.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {organization.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
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
          {!organization.mergedIntoOrganizationId && (
            <button
              type="button"
              onClick={onMerge}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <GitMerge className="h-3.5 w-3.5" />
              รวมข้อมูล
            </button>
          )}
          <form action={toggleFormAction}>
            <input type="hidden" name="id" value={organization.id} />
            <input type="hidden" name="nextActive" value={(!organization.isActive).toString()} />
            <button
              type="submit"
              disabled={togglePending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            >
              {togglePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              {organization.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </form>
          <form
            action={deleteFormAction}
            onSubmit={(e) => {
              if (!confirm(`ยืนยันลบหน่วยงาน "${organization.nameTh}" ?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={organization.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              ลบ
            </button>
          </form>
        </div>
        {toggleState.status === "error" && <p className="mt-1 text-xs text-red-600">{toggleState.message}</p>}
        {deleteState.status === "error" && <p className="mt-1 text-xs text-red-600">{deleteState.message}</p>}
      </td>
    </tr>
  );
}

function OrganizationForm({
  mode,
  organization,
  organizations,
  onDone,
}: {
  mode: "create" | "edit";
  organization?: AdminOrganizationRow;
  organizations: AdminOrganizationRow[];
  onDone: () => void;
}) {
  const action = mode === "create" ? createOrganizationAction : updateOrganizationAction;
  const [state, formAction, isPending] = useActionState(action, idleActionResult);
  const [nameTh, setNameTh] = useState(organization?.nameTh ?? "");
  const [similar, setSimilar] = useState<{ id: string; nameTh: string; similarity: number }[]>([]);
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    if (state.status === "success") {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleCheckSimilar() {
    startCheck(async () => {
      const results = await checkSimilarOrganizationsAction(nameTh, organization?.id);
      setSimilar(results);
    });
  }

  const parentOptions = organizations.filter(
    (o) => o.id !== organization?.id && !o.mergedIntoOrganizationId
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-accent-soft p-4">
      {mode === "edit" && organization && <input type="hidden" name="id" value={organization.id} />}
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="nameTh"
          required
          value={nameTh}
          onChange={(e) => setNameTh(e.target.value)}
          placeholder="ชื่อหน่วยงาน (ภาษาไทย)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="nameEn"
          defaultValue={organization?.nameEn}
          placeholder="ชื่อหน่วยงาน (ภาษาอังกฤษ)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          name="parentId"
          defaultValue={organization?.parentId ?? ""}
          className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
        >
          <option value="">-- ไม่มีหน่วยงานหลัก (เป็นหน่วยงานหลักเอง) --</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nameTh}
            </option>
          ))}
        </select>
        <input
          name="organizationCode"
          defaultValue={organization?.organizationCode}
          placeholder="รหัสหน่วยงาน (ถ้ามี)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="websiteUrl"
          type="url"
          defaultValue={organization?.websiteUrl}
          placeholder="เว็บไซต์ (https://...)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          name="description"
          defaultValue={organization?.description}
          placeholder="คำอธิบาย (ถ้ามี)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
      </div>

      <button
        type="button"
        onClick={handleCheckSimilar}
        disabled={checking || nameTh.trim().length < 2}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checking && <Loader2 className="h-3 w-3 animate-spin" />}
        ตรวจสอบชื่อซ้ำ
      </button>

      {similar.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            พบหน่วยงานที่ชื่อคล้ายกัน — โปรดตรวจสอบก่อนบันทึก
          </p>
          {similar.map((s) => (
            <p key={s.id} className="text-xs text-amber-700">
              {s.nameTh} (คล้ายกัน {Math.round(s.similarity * 100)}%)
            </p>
          ))}
        </div>
      )}

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

function MergeOrganizationForm({
  organization,
  organizations,
  onDone,
}: {
  organization: AdminOrganizationRow;
  organizations: AdminOrganizationRow[];
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(mergeOrganizationsAction, idleActionResult);
  const [targetId, setTargetId] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (state.status === "success") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const candidates = organizations.filter((o) => o.id !== organization.id && !o.mergedIntoOrganizationId);
  const isConfirmValid = confirmText.trim() === organization.nameTh.trim() && targetId !== "";

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <input type="hidden" name="sourceId" value={organization.id} />
      <p className="text-sm text-gray-700">
        รวม &quot;{organization.nameTh}&quot; เข้ากับหน่วยงานหลักที่เลือก — งานวิจัยและผู้วิจัยทั้งหมดที่สังกัดหน่วยงานนี้จะย้ายไปอยู่ภายใต้หน่วยงานหลักแทน
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          name="targetId"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
        >
          <option value="">-- เลือกหน่วยงานหลัก --</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameTh}
            </option>
          ))}
        </select>
        <input name="reason" placeholder="เหตุผล (ไม่บังคับ)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`confirm-${organization.id}`} className="text-xs font-medium text-gray-700">
          พิมพ์ <span className="font-semibold">{organization.nameTh}</span> เพื่อยืนยัน
        </label>
        <input
          id={`confirm-${organization.id}`}
          name="confirmText"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !isConfirmValid}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          ยืนยันรวมข้อมูล
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

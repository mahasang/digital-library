"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { CheckCheck, Loader2 } from "lucide-react";
import { bulkApproveAction } from "@/app/[locale]/dashboard/approvals/[id]/actions";
import {
  BULK_APPROVE_MAX,
  idleBulkApproveState,
  type BulkApproveItemCode,
  type BulkApproveState,
} from "@/lib/approvals/approve-flow";

interface BulkItem {
  id: string;
  title: string;
}

interface BulkContextValue {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  busy: boolean;
  atLimit: boolean;
}

const BulkContext = createContext<BulkContextValue | null>(null);

type FailedCode = Exclude<BulkApproveItemCode, "approved">;

/**
 * อนุมัติหลายรายการในส่วน "รอตรวจสอบ" — ครอบรายการงาน (server component ส่งมาเป็น children)
 * แถบด้านบนมี เลือกทั้งหมด / จำนวนที่เลือก / อนุมัติที่เลือก + ขั้นยืนยันก่อนกดจริง
 * ไม่มีเผยแพร่หลายรายการ · สิทธิ์และสถานะตัดสินฝั่งเซิร์ฟเวอร์ใหม่ทุกรายการเสมอ
 * (ดู bulkApproveAction) ปุ่มและจำนวนบนจอเป็นแค่ UX
 */
export function BulkApproveProvider({
  items,
  children,
}: {
  items: BulkItem[];
  children: ReactNode;
}) {
  const t = useTranslations("dashboard.approvals.bulk");
  const confirmId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<BulkApproveState>(idleBulkApproveState);
  const [lastTitles, setLastTitles] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const titleById = useMemo(() => new Map(items.map((item) => [item.id, item.title])), [items]);
  // นับเฉพาะรายการที่ยังอยู่ในรายการ (อนุมัติแล้วจะหายไปหลังหน้ารีเฟรช)
  const validSelected = selected.filter((id) => titleById.has(id));
  const selectableMax = Math.min(items.length, BULK_APPROVE_MAX);
  const allSelected = validSelected.length > 0 && validSelected.length === selectableMax;
  const atLimit = validSelected.length >= BULK_APPROVE_MAX;

  // ย้ายโฟกัสไปปุ่ม "ยกเลิก" (ค่าปลอดภัย) เมื่อขั้นยืนยันปรากฏ ให้ผู้ใช้คีย์บอร์ด/screen reader รู้ตัว
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  function toggle(id: string) {
    setSelected((prev) => {
      const valid = prev.filter((x) => titleById.has(x));
      if (valid.includes(id)) return valid.filter((x) => x !== id);
      return valid.length >= BULK_APPROVE_MAX ? valid : [...valid, id];
    });
    setConfirming(false);
  }

  function toggleAll() {
    setSelected(allSelected ? [] : items.slice(0, BULK_APPROVE_MAX).map((item) => item.id));
    setConfirming(false);
  }

  function run() {
    const ids = validSelected;
    const formData = new FormData();
    for (const id of ids) formData.append("ids", id);
    setLastTitles(Object.fromEntries(ids.map((id) => [id, titleById.get(id) ?? id])));
    startTransition(async () => {
      try {
        const result = await bulkApproveAction(formData);
        setState(result);
        if (result.status === "done") {
          const approved = new Set(
            result.results.filter((r) => r.code === "approved").map((r) => r.id)
          );
          setSelected((prev) => prev.filter((id) => !approved.has(id)));
        }
      } catch {
        setState({ status: "error", message: t("failedGeneric") });
      } finally {
        setConfirming(false);
      }
    });
  }

  const reasonLabel: Record<FailedCode, string> = {
    not_found: t("reasonNotFound"),
    not_pending: t("reasonNotPending"),
    failed: t("reasonFailed"),
    time_budget: t("reasonTimeBudget"),
  };
  const failedResults =
    state.status === "done"
      ? state.results.filter(
          (result): result is { id: string; code: FailedCode } => result.code !== "approved"
        )
      : [];

  const contextValue: BulkContextValue = {
    isSelected: (id) => validSelected.includes(id),
    toggle,
    busy: pending,
    atLimit,
  };

  return (
    <BulkContext.Provider value={contextValue}>
      <div
        role="group"
        aria-label={t("regionLabel")}
        className="mb-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-3"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={pending}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-600 disabled:cursor-not-allowed"
            />
            {items.length > BULK_APPROVE_MAX
              ? t("selectAllLimited", { max: BULK_APPROVE_MAX })
              : t("selectAll")}
          </label>
          <span className="text-sm text-gray-700">
            {t("selectedCount", { count: validSelected.length })}
          </span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={validSelected.length === 0 || pending}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" />
            {t("approveSelected")}
          </button>
        </div>

        {items.length > BULK_APPROVE_MAX && (
          <p className="text-xs text-gray-600">{t("limitNote", { max: BULK_APPROVE_MAX })}</p>
        )}

        {confirming && (
          <div
            role="group"
            aria-labelledby={confirmId}
            className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3"
          >
            <p id={confirmId} className="text-sm text-amber-900">
              {t("confirmText", { count: validSelected.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={run}
                disabled={pending || validSelected.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? t("processing") : t("confirmYes", { count: validSelected.length })}
              </button>
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {/* พื้นที่ประกาศผลต้องมีอยู่ก่อนเนื้อหาเปลี่ยน screen reader จึงอ่านออก */}
        <div role="status" aria-live="polite" className="text-sm empty:hidden">
          {state.status === "error" && <p className="text-red-700">{state.message}</p>}
          {state.status === "done" && (
            <>
              <p className="font-medium text-gray-900">{state.message}</p>
              {failedResults.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-red-700">{t("resultFailedTitle")}</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
                    {failedResults.map((result) => (
                      <li key={result.id}>
                        {lastTitles[result.id] ?? result.id} — {reasonLabel[result.code]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {children}
    </BulkContext.Provider>
  );
}

/** ช่องติ๊กเลือกของแต่ละการ์ด — ต้องอยู่ใต้ BulkApproveProvider (ถ้าไม่อยู่จะไม่แสดง) */
export function BulkApproveCheckbox({ id, title }: { id: string; title: string }) {
  const t = useTranslations("dashboard.approvals.bulk");
  const context = useContext(BulkContext);
  if (!context) return null;

  const checked = context.isSelected(id);
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={context.busy || (!checked && context.atLimit)}
      onChange={() => context.toggle(id)}
      aria-label={t("checkboxLabel", { title })}
      className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-600 disabled:cursor-not-allowed"
    />
  );
}

"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { addUserRoleAction, removeUserRoleAction } from "@/app/[locale]/superadmin/users/actions";
import { idleActionResult } from "@/lib/actions/types";
import SuperAdminRoleConfirmDialog from "@/components/superadmin/SuperAdminRoleConfirmDialog";
import type { UserRole } from "@/types/research";

const GENERIC_ROLE_OPTIONS: UserRole[] = ["member", "staff", "librarian", "admin"];

export default function UserRolesEditor({
  userId,
  userName,
  userEmail,
  currentRoles,
  isSelf,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  currentRoles: UserRole[];
  isSelf: boolean;
}) {
  const isSuperAdmin = currentRoles.includes("super_admin");

  return (
    <div className="flex flex-col gap-2">
      {GENERIC_ROLE_OPTIONS.map((role) => (
        <RoleCheckboxRow
          key={role}
          userId={userId}
          role={role}
          checked={currentRoles.includes(role)}
        />
      ))}
      <div className="mt-1 border-t border-gray-100 pt-2">
        <SuperAdminRoleRow
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          isSuperAdmin={isSuperAdmin}
          isSelf={isSelf}
        />
      </div>
    </div>
  );
}

function RoleCheckboxRow({
  userId,
  role,
  checked,
}: {
  userId: string;
  role: UserRole;
  checked: boolean;
}) {
  const [addState, addFormAction, addPending] = useActionState(addUserRoleAction, idleActionResult);
  const [removeState, removeFormAction, removePending] = useActionState(
    removeUserRoleAction,
    idleActionResult
  );
  const pending = addPending || removePending;
  const state = checked ? removeState : addState;
  const tRoles = useTranslations("roles");

  return (
    <div>
      <form action={checked ? removeFormAction : addFormAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={role} />
        <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            defaultChecked={checked}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-brand-500"
          />
          {tRoles(role)}
        </label>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
      </form>
      {state.status === "error" && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}

/**
 * แถวบทบาท Super Admin แยกจากบทบาทอื่นโดยเจตนา — คลิก checkbox แล้วเปิด
 * dialog ยืนยันเสมอ (ไม่ toggle ทันทีเหมือนบทบาทอื่น) checked ยังคงสะท้อน
 * สถานะจริงจากเซิร์ฟเวอร์ตลอดเวลา จะเปลี่ยนก็ต่อเมื่อ dialog ยืนยันสำเร็จและ
 * หน้ารีเฟรชข้อมูลใหม่เท่านั้น
 */
function SuperAdminRoleRow({
  userId,
  userName,
  userEmail,
  isSuperAdmin,
  isSelf,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const tRoles = useTranslations("roles");

  return (
    <>
      <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isSuperAdmin}
          onChange={() => setDialogOpen(true)}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="flex items-center gap-1 font-medium text-amber-800">
          <ShieldAlert className="h-3.5 w-3.5" />
          {tRoles("super_admin")}
        </span>
      </label>

      {dialogOpen && (
        <SuperAdminRoleConfirmDialog
          mode={isSuperAdmin ? "revoke" : "grant"}
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          isSelf={isSelf}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}

"use client";

import { useActionState } from "react";
import { Loader2, Power, ShieldCheck, Crown } from "lucide-react";
import {
  changeUserRoleAction,
  toggleUserActiveAction,
} from "@/app/[locale]/dashboard/users/actions";
import { idleActionResult } from "@/lib/actions/types";
import { roleLabels } from "@/lib/labels";
import type { AdminUserRow } from "@/lib/data/admin-users.server";
import type { UserRole } from "@/types/research";

const ASSIGNABLE_ROLES: UserRole[] = ["member", "staff", "librarian", "admin"];

export default function UserManager({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">ผู้ใช้</th>
            <th className="px-4 py-3 font-medium">หน่วยงาน</th>
            <th className="px-4 py-3 font-medium">บทบาท</th>
            <th className="px-4 py-3 font-medium">สถานะ</th>
            <th className="px-4 py-3 font-medium">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const [roleState, roleFormAction, rolePending] = useActionState(
    changeUserRoleAction,
    idleActionResult
  );
  const [activeState, activeFormAction, activePending] = useActionState(
    toggleUserActiveAction,
    idleActionResult
  );

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">
          {user.fullName}
          {isSelf && <span className="ml-1.5 text-xs text-gray-500">(คุณ)</span>}
        </p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </td>
      <td className="px-4 py-3 text-gray-500">{user.organizationName || "—"}</td>
      <td className="px-4 py-3">
        {user.role === "super_admin" ? (
          <span
            title="จัดการบทบาท Super Admin ได้ที่ /superadmin เท่านั้น"
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
          >
            <Crown className="h-3 w-3" />
            {roleLabels.super_admin}
          </span>
        ) : (
          <form action={roleFormAction} className="flex items-center gap-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <select
              name="role"
              defaultValue={user.role}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              disabled={rolePending}
              className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
            {rolePending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
          </form>
        )}
        {roleState.status === "error" && (
          <p className="mt-1 text-xs text-red-600">{roleState.message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          <ShieldCheck className="h-3 w-3" />
          {user.isActive ? "ใช้งานได้" : "ถูกระงับ"}
        </span>
      </td>
      <td className="px-4 py-3">
        <form action={activeFormAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="nextActive" value={(!user.isActive).toString()} />
          <button
            type="submit"
            disabled={activePending || isSelf}
            title={isSelf ? "ไม่สามารถระงับบัญชีของตัวเองได้" : undefined}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            {user.isActive ? "ระงับบัญชี" : "เปิดใช้งาน"}
          </button>
        </form>
        {activeState.status === "error" && (
          <p className="mt-1 text-xs text-red-600">{activeState.message}</p>
        )}
      </td>
    </tr>
  );
}

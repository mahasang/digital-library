import type { WorkspaceLink } from "@/components/layout/UserMenu";
import type { SessionUser } from "@/lib/supabase/session";
import type { UserRole } from "@/types/research";

/**
 * i18n Phase 1 — ไฟล์นี้เป็น plain .ts (ไม่ใช่ component) จึงเรียก
 * useTranslations()/getTranslations() เองไม่ได้ ส่งคืน labelKey (เช่น
 * "workspace.favorites") แทน label ที่แปลแล้วตรงๆ — ผู้เรียก
 * (HeaderAccountArea.tsx ซึ่งเป็น Server Component) เป็นผู้แปล labelKey ->
 * label ก่อนส่งลง UserMenu.tsx ต่อ (WorkspaceLink ที่ UserMenu คาดหวังยังคง
 * มี label: string เหมือนเดิมทุกประการ ไม่ได้แก้ type ของ UserMenu เลย)
 */
export type WorkspaceLinkKey = Omit<WorkspaceLink, "label"> & { labelKey: string };

/**
 * Pure role -> workspace-link logic, kept in a plain .ts file (Hallmark —
 * header rendering refactor) so it can be unit-tested directly with Vitest
 * — this project's Vitest config doesn't have a JSX/React plugin set up
 * (no component-rendering tests exist anywhere in the codebase; tsconfig's
 * `jsx: "preserve"` isn't something Vite's esbuild transform understands on
 * its own), so importing anything from a .tsx file into a .test.ts file
 * fails to parse. Business logic that needs a unit test lives in .ts files
 * throughout this codebase (see lib/search/rank.ts for the same pattern) —
 * components/layout/HeaderAccountArea.tsx (.tsx, has JSX) imports this
 * instead of defining the logic inline.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  guest: 0,
  member: 10,
  staff: 20,
  librarian: 30,
  admin: 40,
  super_admin: 50,
};

export function buildWorkspaceLinks(user: SessionUser | null): WorkspaceLinkKey[] {
  const rank = user ? ROLE_RANK[user.role] : 0;
  const isStaffOrAbove = rank >= 20;
  const isLibrarianOrAbove = rank >= 30;
  const isSuperAdmin = rank >= 50;

  return [
    ...(user
      ? [
          { href: "/favorites", labelKey: "workspace.favorites", iconKey: "favorites" as const },
          {
            href: "/access-requests",
            labelKey: "workspace.accessRequests",
            iconKey: "accessRequests" as const,
          },
        ]
      : []),
    ...(isStaffOrAbove
      ? [
          {
            href: "/submit-research",
            labelKey: "workspace.submitResearch",
            iconKey: "submitResearch" as const,
          },
          {
            href: "/my-submissions",
            labelKey: "workspace.mySubmissions",
            iconKey: "mySubmissions" as const,
          },
        ]
      : []),
    ...(isLibrarianOrAbove
      ? [{ href: "/dashboard", labelKey: "workspace.dashboard", iconKey: "dashboard" as const }]
      : []),
    ...(isSuperAdmin
      ? [
          {
            href: "/superadmin/overview",
            labelKey: "workspace.superAdmin",
            iconKey: "superAdmin" as const,
          },
        ]
      : []),
  ];
}

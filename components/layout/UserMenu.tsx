"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserCircle,
  ChevronDown,
  Heart,
  Send,
  FileText,
  FileQuestion,
  LayoutDashboard,
  Crown,
  Settings,
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import type { SessionUser } from "@/lib/supabase/session";

export const WORKSPACE_ICONS = {
  favorites: Heart,
  accessRequests: FileQuestion,
  submitResearch: Send,
  mySubmissions: FileText,
  dashboard: LayoutDashboard,
  superAdmin: Crown,
} as const;

export type WorkspaceIconKey = keyof typeof WORKSPACE_ICONS;

/**
 * `iconKey` (ชื่อ string) แทนการอ้าง component ไอคอนตรงๆ (Hallmark — header
 * rendering refactor) — WorkspaceLink[] ตอนนี้ถูกสร้างจาก
 * components/layout/HeaderAccountArea.tsx ซึ่งเป็น Server Component แล้วส่ง
 * เข้ามาเป็น prop ของ Client Component นี้ การส่ง reference ของ component
 * ไอคอน (จาก lucide-react ซึ่งไม่ได้ทำเครื่องหมาย "use client") ข้ามขอบเขต
 * server -> client แบบนั้นไม่ serialize ได้จริง (React จะได้ค่า undefined
 * ฝั่ง client แล้ว error "Element type is invalid") — ส่งแค่ชื่อ key (string,
 * serialize ได้ปกติ) แล้วให้ฝั่ง client (ไฟล์นี้เท่านั้น ซึ่งมี "use client"
 * และ import ไอคอนจริงอยู่แล้ว) เป็นผู้ map เป็น component ไอคอนเองแทน
 */
export interface WorkspaceLink {
  href: string;
  label: string;
  iconKey: WorkspaceIconKey;
}

export default function UserMenu({
  user,
  workspaceLinks,
}: {
  user: SessionUser;
  workspaceLinks: WorkspaceLink[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      >
        <UserCircle className="h-4 w-4" />
        <span className="max-w-[140px] truncate">
          {user.fullName || user.email || "โปรไฟล์ของฉัน"}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-surface py-1.5 shadow-lg">
            {workspaceLinks.length > 0 && (
              <>
                {workspaceLinks.map((link) => {
                  const Icon = WORKSPACE_ICONS[link.iconKey];
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Icon className="h-4 w-4 text-gray-500" />
                      {link.label}
                    </Link>
                  );
                })}
                <div className="my-1.5 border-t border-gray-100" />
              </>
            )}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 text-gray-500" />
              โปรไฟล์ของฉัน
            </Link>
            <div className="my-1.5 border-t border-gray-100" />
            <div className="px-2">
              <LogoutButton className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

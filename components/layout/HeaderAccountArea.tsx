import Link from "next/link";
import { UserCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import LogoutButton from "@/components/auth/LogoutButton";
import NotificationBell from "@/components/layout/NotificationBell";
import UserMenu from "@/components/layout/UserMenu";
import { getSessionUser } from "@/lib/supabase/session";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/data/notifications.server";
import { buildWorkspaceLinks } from "@/lib/auth/workspace-links";

/**
 * Hallmark — header rendering refactor. เดิม app/layout.tsx เรียก
 * getSessionUser() + getMyNotifications()/getUnreadNotificationCount() เป็น
 * ส่วนหนึ่งของ Promise.all ที่บล็อกทั้งหน้าทุก route (ต้องรอให้เสร็จก่อน React
 * จะเริ่ม render อะไรเลยได้ เพราะไม่มี Suspense boundary คั่นไว้) — ย้ายมาไว้ที่
 * component นี้แทน เป็น Server Component ของตัวเอง ให้ app/layout.tsx ห่อด้วย
 * <Suspense> ได้ (ดู app/layout.tsx) เพื่อให้เนื้อหาสาธารณะของหน้า ({children})
 * stream ออกไปได้โดยไม่ต้องรอข้อมูลบัญชีผู้ใช้ที่ช้ากว่าและเปลี่ยนตามแต่ละคน
 *
 * เรียกซ้ำ 2 ครั้งจาก app/layout.tsx (variant="desktop" กับ variant="mobile"
 * — แต่ละอันอยู่ใน <Suspense> ของตัวเอง เพราะแถบเดสก์ท็อปกับเมนูมือถือ render
 * คนละตำแหน่งใน DOM ของ Header ซึ่งเป็น Client Component ไม่สามารถ "ใช้ node
 * เดียวกันซ้ำสองที่" ได้ — แต่ละครั้งจึงเรียก getSessionUser()/notifications
 * ของตัวเองแยกกัน (ซ้ำกับที่ IdleLogoutGate และ middleware เรียกด้วย) **ไม่ใช่
 * ความผิดพลาด — งานนี้ระบุไว้ชัดเจนว่าไม่ต้องลดความซ้ำซ้อนของ
 * getUser()/getSessionUser() ในรอบนี้ เป็นงานที่เก็บไว้ทำแยกต่างหาก**
 *
 * ตรวจสอบสิทธิ์ (role) ทั้งหมดยังคงทำฝั่งเซิร์ฟเวอร์เหมือนเดิมทุกประการผ่าน
 * getSessionUser() (ยืนยันตัวตนจริงกับ Supabase Auth + query ตาราง
 * profiles/user_roles) — ไม่มีการส่งต่อ user/role จาก middleware ผ่าน request
 * header ที่เชื่อถือได้แทนการตรวจสอบฝั่งเซิร์ฟเวอร์แต่อย่างใด
 */

async function loadAccountData() {
  const user = await getSessionUser();
  const [notifications, unreadCount] = user
    ? await Promise.all([getMyNotifications(), getUnreadNotificationCount()])
    : [[], 0];
  return { user, notifications, unreadCount, workspaceLinks: buildWorkspaceLinks(user) };
}

/**
 * Loading fallback ที่แสดงระหว่างรอ HeaderAccountArea (ผ่าน <Suspense> ใน
 * app/layout.tsx) — ใช้ role="status" (มี aria-live="polite" โดยปริยายตาม
 * ARIA spec) พร้อม aria-label ให้ screen reader ประกาศว่ากำลังโหลดอยู่ ส่วน
 * โครงร่างที่เห็นเป็น aria-hidden เพราะไม่มีความหมายเชิงเนื้อหา ขนาดใกล้เคียง
 * เนื้อหาจริงเพื่อลด layout shift เมื่อสลับเป็นเนื้อหาจริง แอนิเมชัน pulse
 * เคารพ prefers-reduced-motion อยู่แล้วผ่าน CSS กลางของทั้งเว็บ (app/globals.css)
 */
export function HeaderAccountAreaSkeleton({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "desktop") {
    return (
      <span role="status" aria-label="กำลังโหลดเมนูผู้ใช้" className="flex items-center gap-2">
        <span aria-hidden="true" className="h-9 w-9 animate-pulse rounded-md bg-gray-100" />
        <span aria-hidden="true" className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label="กำลังโหลดเมนูผู้ใช้"
      className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3"
    >
      <span aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-gray-100" />
    </span>
  );
}

export default async function HeaderAccountArea({
  variant,
}: {
  variant: "desktop" | "mobile";
}) {
  const { user, notifications, unreadCount, workspaceLinks } = await loadAccountData();

  if (variant === "desktop") {
    return user ? (
      <>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <UserMenu user={user} workspaceLinks={workspaceLinks} />
      </>
    ) : (
      <>
        <LinkButton href="/login" variant="outline" size="sm">
          เข้าสู่ระบบ
        </LinkButton>
        <LinkButton href="/register" variant="primary" size="sm">
          สมัครสมาชิก
        </LinkButton>
      </>
    );
  }

  // variant === "mobile" — ต่อท้าย navLinks (ที่ Header render เองเพราะเป็น
  // ข้อมูลสาธารณะล้วน ไม่ต้องรอส่วนนี้) ด้วย workspaceLinks ที่ผูกกับสิทธิ์
  // ผู้ใช้ ตามด้วยส่วนโปรไฟล์/ออกจากระบบ หรือเข้าสู่ระบบ/สมัครสมาชิก — ปิดเมนู
  // มือถือเมื่อคลิกลิงก์ใดๆ ทำที่ Header เอง (useEffect ตาม pathname) แทนการส่ง
  // callback ปิดเมนูข้ามจาก Server Component ซึ่งทำไม่ได้
  return (
    <>
      {workspaceLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {link.label}
        </Link>
      ))}
      {user ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3">
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <UserCircle className="h-4 w-4" />
            {user.fullName || user.email || "โปรไฟล์ของฉัน"}
          </Link>
          <LogoutButton className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50" />
        </div>
      ) : (
        <div className="mt-2 flex gap-2 border-t border-gray-100 pt-3">
          <LinkButton href="/login" variant="outline" size="sm" className="flex-1">
            เข้าสู่ระบบ
          </LinkButton>
          <LinkButton href="/register" variant="primary" size="sm" className="flex-1">
            สมัครสมาชิก
          </LinkButton>
        </div>
      )}
    </>
  );
}

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * next-intl v4 ไม่ export useRouter/usePathname/Link ตรงจาก
 * 'next-intl/navigation' (มีแค่ createNavigation ให้เรียกครั้งเดียว) —
 * ไฟล์นี้เป็นจุดเดียวที่เรียก createNavigation() แล้ว component อื่นทั้งหมด
 * import จากที่นี่แทน
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

import type { LucideIcon } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

/** สถานะว่างที่ใช้ร่วมกันในหน้ารายการโปรด/ประวัติการอ่าน/การแจ้งเตือน —
 * ให้หน้าตาสอดคล้องกับ AccountResearchRow และ NotificationRow เมื่อมีข้อมูล
 * ตอนนี้ส่งต่อไปยัง components/ui/EmptyState.tsx (Phase 4) ซึ่งเป็น primitive
 * กลางที่ Dashboard/Super Admin ใช้ร่วมด้วย — หน้าตาเหมือนเดิมทุกประการ */
export default function AccountEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return <EmptyState icon={icon} title={title} description={description} action={action} />;
}

import type { AppNotification } from "@/types/research";

type NotificationReadState = Pick<AppNotification, "id" | "readAt">;

/**
 * ตัวเลขบนกระดิ่ง = unreadCount จากเซิร์ฟเวอร์ ลบรายการที่ client เพิ่งสั่ง
 * "ทำเครื่องหมายว่าอ่านแล้ว" ตอนเปิดแผง แต่เซิร์ฟเวอร์ยังไม่ส่งข้อมูลใหม่กลับมา
 * (readAt ยังเป็น null ใน props) — ทำให้ตัวเลขลดทันทีโดยไม่รอ revalidate
 *
 * พอ props ใหม่มาถึง รายการเหล่านั้นจะมี readAt แล้ว จึงไม่ถูกลบซ้ำสองรอบ
 */
export function displayUnreadCount(
  unreadCount: number,
  notifications: readonly NotificationReadState[],
  locallyRead: ReadonlySet<string>
): number {
  const pendingLocally = notifications.filter(
    (n) => !n.readAt && locallyRead.has(n.id)
  ).length;
  return Math.max(0, unreadCount - pendingLocally);
}

/** id ของรายการที่ยังไม่อ่าน และยังไม่ได้ถูกสั่ง mark ไว้ — ใช้ตอนเปิดแผง */
export function unreadIdsToMark(
  notifications: readonly NotificationReadState[],
  locallyRead: ReadonlySet<string>
): string[] {
  return notifications
    .filter((n) => !n.readAt && !locallyRead.has(n.id))
    .map((n) => n.id);
}

/** แถวยังแสดงเป็น "ใหม่" (ไฮไลต์) ได้ตลอดที่แผงเปิดอยู่ แม้ถูก mark ว่าอ่านแล้ว */
export function isShownAsUnread(
  notification: NotificationReadState,
  highlightedIds: ReadonlySet<string>
): boolean {
  return !notification.readAt || highlightedIds.has(notification.id);
}

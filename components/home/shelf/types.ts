/** จำนวนเล่มบนชั้น แยกจาก homepageLatestCount ที่แอดมินตั้งได้ 1–24 */
export const SHELF_SIZE = 16;

export interface ShelfBook {
  /** slug ใช้กับ /research/[id] */
  id: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  categoryName: string;
  /** null เมื่อไม่มีปกจริง จะวาดเป็นปกเรียงพิมพ์แทน */
  coverUrl: string | null;
}

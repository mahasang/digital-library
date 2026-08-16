import type { DocumentStatus } from "@/types/research";

export interface StatusCount {
  status: DocumentStatus;
  count: number;
}

export interface StatusPieSlice {
  name: string;
  value: number;
  status: DocumentStatus;
}

/**
 * แปลงข้อมูลจำนวนงานวิจัยแยกตามสถานะ ให้เป็นข้อมูลสำหรับ pie chart —
 * ตัดสถานะที่ไม่มีข้อมูล (count 0) ออก เพื่อไม่ให้ legend/สัดส่วนแสดง
 * รายการที่ไม่มีอยู่จริง (0% ก็ไม่แสดง ไม่ใช่แค่ไม่ระบายสี)
 *
 * แยกออกมาเป็นฟังก์ชันล้วน (pure function) จาก StatusPieChart component
 * เพื่อทดสอบ regression การแปลงข้อมูลได้โดยไม่ต้อง render recharts จริง
 * (ดู statusPieChart.test.ts) — ไม่เปลี่ยนพฤติกรรมเดิมแต่อย่างใด
 *
 * getLabel รับ status label แบบแปลแล้วจากผู้เรียก (เช่น useTranslations("statuses"))
 * เนื่องจากฟังก์ชันนี้เป็น pure function ที่ไม่ผูกกับ next-intl โดยตรง
 */
export function buildStatusPieChartData(
  data: StatusCount[],
  getLabel: (status: DocumentStatus) => string
): StatusPieSlice[] {
  return data
    .filter((d) => d.count > 0)
    .map((d) => ({ name: getLabel(d.status), value: d.count, status: d.status }));
}

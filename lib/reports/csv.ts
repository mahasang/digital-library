export interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** แปลงข้อมูลเป็น CSV พร้อม UTF-8 BOM (ให้ Excel เปิดภาษาไทยได้ถูกต้อง) */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(",")
  );
  return "﻿" + [header, ...lines].join("\r\n");
}

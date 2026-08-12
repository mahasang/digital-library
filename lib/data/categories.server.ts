import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { categories as mockCategories } from "@/data/categories";
import {
  PUBLIC_CATEGORIES_TAG,
  PUBLIC_HOME_TAG,
  PUBLIC_HOME_REVALIDATE_SECONDS,
} from "@/lib/cache/public-home";
import type { Category } from "@/types/research";

export interface AdminCategoryRow {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  description: string;
  icon: string;
  parentId: string | null;
  parentNameTh: string | null;
  isActive: boolean;
  researchCount: number;
  sortOrder: number;
}

interface RawCategoryRow {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * เรียงลำดับแบบต้นไม้ให้แบนราบ (หมวดหมู่หลักตาม sort_order ของตัวเอง แล้วตาม
 * ด้วยหมวดหมู่ย่อยของมันตาม sort_order ของมันเอง ก่อนขึ้นหมวดหมู่หลักถัดไป)
 * — ใช้ทั้งหน้าเว็บสาธารณะและ /dashboard/categories/​/superadmin/categories
 * เพื่อให้ลำดับที่เห็นตรงกันทุกที่ รองรับกรณีข้อมูลกำพร้า (parent ถูกกรองออก
 * เช่น ปิดใช้งาน) โดยแสดงต่อท้ายแทนการซ่อนไปเงียบๆ
 */
function sortCategoriesHierarchically(rows: RawCategoryRow[]): RawCategoryRow[] {
  const byParent = new Map<string | null, RawCategoryRow[]>();
  for (const row of rows) {
    const key = row.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.sort_order - b.sort_order || a.name_th.localeCompare(b.name_th, "th")
    );
  }

  const visited = new Set<string>();
  const result: RawCategoryRow[] = [];

  function appendChildren(parentId: string | null) {
    for (const child of byParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push(child);
      appendChildren(child.id);
    }
  }

  appendChildren(null);

  for (const row of rows) {
    if (!visited.has(row.id)) {
      visited.add(row.id);
      result.push(row);
    }
  }

  return result;
}

function mapRow(row: RawCategoryRow): Category {
  return {
    id: row.slug,
    nameTh: row.name_th,
    nameEn: row.name_en,
    description: row.description ?? "",
    icon: row.icon ?? "",
    parentId: row.parent_id,
    isActive: row.is_active,
  };
}

/**
 * ดึงหมวดหมู่ที่เปิดใช้งานจริงจาก Supabase — แยกออกมาจาก getCategories()
 * ด้านล่างเพื่อห่อด้วย unstable_cache ได้ (Hallmark — public homepage
 * caching) ใช้ createPublicClient() (ไม่ผูกกับ cookies) เพราะ RLS ของตาราง
 * categories เปิดให้ role "anon" อ่านได้ทั้งหมดอยู่แล้วโดยไม่มีเงื่อนไขเรื่อง
 * สิทธิ์ผู้ใช้เลย (`categories_select_all` using (true)) ผลลัพธ์จึงเหมือนกัน
 * ทุกประการไม่ว่าใครจะเรียก — ปลอดภัยต่อการ cache ข้ามผู้ใช้
 */
async function fetchCategoriesFromDb(): Promise<Category[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_th, name_en, description, icon, parent_id, is_active, sort_order")
    .eq("is_active", true);

  if (error) {
    throw new Error(`ไม่สามารถดึงข้อมูลหมวดหมู่จาก Supabase ได้: ${error.message}`);
  }

  return sortCategoriesHierarchically(data ?? []).map(mapRow);
}

const getCachedCategories = unstable_cache(fetchCategoriesFromDb, ["public-categories"], {
  tags: [PUBLIC_CATEGORIES_TAG, PUBLIC_HOME_TAG],
  revalidate: PUBLIC_HOME_REVALIDATE_SECONDS,
});

/**
 * หมวดหมู่ที่เปิดใช้งาน — สำหรับหน้าเว็บสาธารณะ (มี Mock Data เป็น fallback)
 * ใช้ทั้งใน root layout (Footer), หน้าแรก, และหน้าอื่นๆ ที่ต้องเลือกหมวดหมู่
 * (ฟอร์มส่งงานวิจัย, ตัวกรองค้นหา) — ข้อมูลนี้เป็นสาธารณะล้วนไม่มีผลต่อการ
 * ตัดสินใจเชิงสิทธิ์/ธุรกิจใดๆ (ต่างจาก settings — ดู getPublicHomeSettings()
 * ใน lib/data/settings.server.ts) จึงปลอดภัยที่จะ cache ข้าม request ทั้งฟังก์ชัน
 *
 * ห่อชั้นนอกด้วย React cache() (Hallmark — homepage data-flow optimization,
 * เดิมเรียกซ้ำหลายจุดต่อการโหลดหน้าแรกหนึ่งครั้ง) และห่อชั้นในด้วย
 * unstable_cache (Hallmark — public homepage caching) ทั้งสองชั้นทำงานร่วมกัน
 * ได้: cache() ลดการเรียกซ้ำภายใน request เดียวกัน, unstable_cache ลดการ
 * query จริงข้าม request/ผู้ใช้
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) {
    return mockCategories;
  }
  return getCachedCategories();
});

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const items = await getCategories();
  return items.find((c) => c.id === id);
}

/** หมวดหมู่ที่เปิดใช้งาน พร้อม id จริง (uuid) — สำหรับติดตามหมวดหมู่
 * (category_subscriptions) ที่ต้องใช้ uuid จริงเป็น FK ต่างจาก Category.id
 * ทั่วไปที่เป็น slug (ดู mapRow ด้านบน) ไม่มี Mock fallback เนื่องจากการติดตาม
 * หมวดหมู่ใช้ได้เฉพาะเมื่อเชื่อมต่อ Supabase จริงเท่านั้น */
export async function getActiveCategoriesWithId(): Promise<
  { id: string; nameTh: string; nameEn: string }[]
> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_th, name_en, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("getActiveCategoriesWithId failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({ id: row.id, nameTh: row.name_th, nameEn: row.name_en }));
}

/**
 * หมวดหมู่ทั้งหมดรวมที่ปิดใช้งาน พร้อม id จริง (uuid) และจำนวนงานวิจัยที่ผูกอยู่
 * สำหรับ /dashboard/categories และ /superadmin/categories (ไม่มี Mock fallback)
 */
export async function getAllCategoriesForAdmin(): Promise<AdminCategoryRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const [categoriesRes, linksRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name_th, name_en, description, icon, parent_id, is_active, sort_order"),
    supabase.from("research_categories").select("category_id"),
  ]);

  const rows = categoriesRes.data ?? [];
  const nameById = new Map(rows.map((r) => [r.id, r.name_th]));
  const countByCategory = new Map<string, number>();
  for (const link of linksRes.data ?? []) {
    countByCategory.set(
      link.category_id,
      (countByCategory.get(link.category_id) ?? 0) + 1
    );
  }

  return sortCategoriesHierarchically(rows).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameTh: row.name_th,
    nameEn: row.name_en,
    description: row.description ?? "",
    icon: row.icon ?? "",
    parentId: row.parent_id,
    parentNameTh: row.parent_id ? (nameById.get(row.parent_id) ?? null) : null,
    isActive: row.is_active,
    researchCount: countByCategory.get(row.id) ?? 0,
    sortOrder: row.sort_order,
  }));
}

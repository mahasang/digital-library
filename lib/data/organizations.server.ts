import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { organizations as mockOrganizations } from "@/data/organizations";
import {
  PUBLIC_ORGANIZATIONS_TAG,
  PUBLIC_HOME_TAG,
  PUBLIC_HOME_REVALIDATE_SECONDS,
} from "@/lib/cache/public-home";
import type { Organization } from "@/types/research";

export interface AdminOrganizationRow {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  description: string;
  isActive: boolean;
  researchCount: number;
  sortOrder: number;
  parentId: string | null;
  parentNameTh: string | null;
  organizationCode: string;
  websiteUrl: string;
  mergedIntoOrganizationId: string | null;
}

interface RawAdminOrgRow {
  id: string;
  slug: string;
  name_th: string;
  name_en: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  parent_id: string | null;
  organization_code: string | null;
  website_url: string | null;
  merged_into_organization_id: string | null;
}

/** เรียงลำดับแบบต้นไม้ให้แบนราบ (เหมือน sortCategoriesHierarchically ใน
 * categories.server.ts) — หน่วยงานหลักตาม sort_order ตามด้วยหน่วยงานย่อยของ
 * มันเอง ก่อนขึ้นหน่วยงานหลักถัดไป รองรับข้อมูลกำพร้า (parent ถูกรวม/ปิดใช้งาน) */
function sortOrganizationsHierarchically(rows: RawAdminOrgRow[]): RawAdminOrgRow[] {
  const byParent = new Map<string | null, RawAdminOrgRow[]>();
  for (const row of rows) {
    const key = row.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name_th.localeCompare(b.name_th, "th"));
  }

  const visited = new Set<string>();
  const result: RawAdminOrgRow[] = [];

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

/**
 * ดึงหน่วยงานที่เปิดใช้งานจริงจาก Supabase — แยกออกมาเพื่อห่อด้วย
 * unstable_cache ได้ (เหมือน fetchCategoriesFromDb ใน categories.server.ts)
 * ใช้ createPublicClient() (ไม่ผูกกับ cookies) เพราะ RLS ของตาราง organizations
 * เปิดให้ role "anon" อ่านได้ทั้งหมดอยู่แล้วโดยไม่มีเงื่อนไขเรื่องสิทธิ์ผู้ใช้เลย
 * (`organizations_select_all` using (true)) — ดู
 * supabase/migrations/20260731100200_rls_policies.sql — ผลลัพธ์จึงเหมือนกัน
 * ทุกประการไม่ว่าใครจะเรียก ปลอดภัยต่อการ cache ข้ามผู้ใช้
 */
async function fetchOrganizationsFromDb(): Promise<Organization[] | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name_th, name_en")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_th", { ascending: true });

  if (error) {
    // เดิม throw ตรงนี้ทำให้ทั้งหน้าแรก crash เป็น "Application error" ทันทีถ้า
    // query ล้มเหลวแม้จะเป็นสาเหตุชั่วคราว/กู้คืนได้เอง (เช่น access token เก่าที่
    // ค้างอยู่ใน cookie ของผู้ใช้จากช่วงที่นาฬิกาเครื่อง Docker/WSL2 คลาดเคลื่อน —
    // ดู decodeJwtIat ใน lib/supabase/middleware.ts — PostgREST ปฏิเสธด้วย "JWT
    // issued at future" แม้ middleware เองจะยังไม่เห็นว่าเสียหายก็ตาม) ฟังก์ชันพี่
    // น้องอื่นในไฟล์นี้ (findSimilarOrganizations, getAllOrganizationsForAdmin)
    // ไม่เคย throw แบบนี้อยู่แล้ว — เปลี่ยนให้เหมือนกัน: log แล้ว fallback เป็น
    // mockOrganizations แทน หน้าแรกจึงยัง render ต่อได้เสมอแม้ query นี้จะล้มเหลว
    // ชั่วคราว ไม่ใช่การซ่อนข้อผิดพลาดจริงที่ต้องแก้ไข (ยัง log ไว้ให้เห็นเสมอ)
    //
    // คืน null แทนการคืน mockOrganizations ตรงนี้ (ต่างจากเดิม) เพราะฟังก์ชันนี้
    // อยู่ภายใน unstable_cache — ถ้า cache ผลลัพธ์ mock ไว้ตอน query ล้มเหลวชั่วคราว
    // ผู้เข้าชมจะเห็นข้อมูลปลอมค้างอยู่นานถึง revalidate รอบถัดไป จึงส่ง null ให้
    // getOrganizations() ด้านล่าง (นอก cache) เป็นผู้ตัดสินใจ fallback แทน
    console.error("fetchOrganizationsFromDb failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameTh: row.name_th,
    nameEn: row.name_en ?? "",
  }));
}

const getCachedOrganizations = unstable_cache(fetchOrganizationsFromDb, ["public-organizations"], {
  tags: [PUBLIC_ORGANIZATIONS_TAG, PUBLIC_HOME_TAG],
  revalidate: PUBLIC_HOME_REVALIDATE_SECONDS,
});

/** หน่วยงานที่เปิดใช้งาน — สำหรับตัวเลือกในฟอร์มส่งงานวิจัยและหน้าแรก (มี Mock
 * Data เป็น fallback) ข้อมูลนี้เป็นสาธารณะล้วน ไม่มีผลต่อการตัดสินใจเชิงสิทธิ์/
 * ธุรกิจใดๆ จึงปลอดภัยที่จะ cache ข้าม request (ดู fetchOrganizationsFromDb ด้านบน) */
export async function getOrganizations(): Promise<Organization[]> {
  if (!isSupabaseConfigured()) {
    return mockOrganizations;
  }

  const result = await getCachedOrganizations();
  return result ?? mockOrganizations;
}

/** หน่วยงานทั้งหมดรวมที่ปิดใช้งาน/ถูกรวมแล้ว — สำหรับ /dashboard/organizations
 * และ /superadmin/organizations เท่านั้น เรียงแบบต้นไม้ตามโครงสร้างหลัก/ย่อย */
export async function getAllOrganizationsForAdmin(): Promise<AdminOrganizationRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const [orgsRes, researchRes] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, slug, name_th, name_en, description, is_active, sort_order, parent_id, organization_code, website_url, merged_into_organization_id"
      ),
    supabase.from("research_items").select("organization_id"),
  ]);

  const countByOrg = new Map<string, number>();
  for (const item of researchRes.data ?? []) {
    if (!item.organization_id) continue;
    countByOrg.set(item.organization_id, (countByOrg.get(item.organization_id) ?? 0) + 1);
  }

  const rows = orgsRes.data ?? [];
  const nameById = new Map(rows.map((r) => [r.id, r.name_th]));

  return sortOrganizationsHierarchically(rows).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameTh: row.name_th,
    nameEn: row.name_en ?? "",
    description: row.description ?? "",
    isActive: row.is_active,
    researchCount: countByOrg.get(row.id) ?? 0,
    sortOrder: row.sort_order,
    parentId: row.parent_id,
    parentNameTh: row.parent_id ? (nameById.get(row.parent_id) ?? null) : null,
    organizationCode: row.organization_code ?? "",
    websiteUrl: row.website_url ?? "",
    mergedIntoOrganizationId: row.merged_into_organization_id,
  }));
}

/** หน่วยงานที่ชื่อไทย/อังกฤษคล้ายกันมาก (สำหรับคำเตือน "อาจซ้ำ" ในหน้าจัดการ)
 * ใช้ pg_trgm similarity เทียบกับหน่วยงานที่ Active ทั้งหมด ไม่รวมตัวเอง */
export async function findSimilarOrganizations(
  nameTh: string,
  excludeId?: string
): Promise<{ id: string; nameTh: string; similarity: number }[]> {
  if (!isSupabaseConfigured() || !nameTh.trim()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_similar_organizations_by_name", {
    p_name_th: nameTh,
    p_exclude_id: excludeId ?? null,
  });

  if (error) {
    console.error("findSimilarOrganizations failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: { id: string; name_th: string; sim: number }) => ({
    id: row.id,
    nameTh: row.name_th,
    similarity: row.sim,
  }));
}

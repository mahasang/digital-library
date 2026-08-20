import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type PublicAuthorProfile = {
  id: string;
  name: string;
  displayNameEn: string | null;
  titlePrefixTh: string | null;
  titlePrefixEn: string | null;
  biography: string | null;
  orcid: string | null;
  orcidVerifiedAt: string | null;
  orcidOauthVerifiedAt: string | null;
  organization: { id: string; nameTh: string } | null;
};

export type PublicAuthorResearch = {
  /** = research_items.slug (URL identifier เดียวกับ ResearchItem.id ทั้งแอป ดู lib/data/mappers.ts) */
  id: string;
  titleTh: string;
  titleEn: string | null;
  publishedAt: string | null;
  accessLevel: string;
  coverImage: string | null;
  categories: { slug: string; nameTh: string }[];
};

/** ข้อมูลผู้วิจัยสำหรับหน้าโปรไฟล์สาธารณะ — เฉพาะที่ is_active = true และไม่ถูก
 * รวม (merged_into_author_id เป็น null) เท่านั้น ผู้วิจัยที่ถูกรวมแล้วไม่มีหน้า
 * โปรไฟล์ของตัวเองอีกต่อไป (ดูงานวิจัยของเขาผ่านผู้วิจัยหลักที่ถูกรวมเข้าแทน) */
export const getPublicAuthorProfile = cache(
  async (id: string): Promise<PublicAuthorProfile | null> => {
    if (!isSupabaseConfigured() || !id) return null;

    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("authors")
      .select(
        "id, name, display_name_en, title_prefix_th, title_prefix_en, biography, orcid, orcid_verified_at, orcid_oauth_verified_at, organization_id, organizations ( name_th )"
      )
      .eq("id", id)
      .eq("is_active", true)
      .is("merged_into_author_id", null)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as {
      id: string;
      name: string;
      display_name_en: string | null;
      title_prefix_th: string | null;
      title_prefix_en: string | null;
      biography: string | null;
      orcid: string | null;
      orcid_verified_at: string | null;
      orcid_oauth_verified_at: string | null;
      organization_id: string | null;
      organizations: { name_th: string } | null;
    };

    return {
      id: row.id,
      name: row.name,
      displayNameEn: row.display_name_en,
      titlePrefixTh: row.title_prefix_th,
      titlePrefixEn: row.title_prefix_en,
      biography: row.biography,
      orcid: row.orcid,
      orcidVerifiedAt: row.orcid_verified_at,
      orcidOauthVerifiedAt: row.orcid_oauth_verified_at,
      organization:
        row.organization_id && row.organizations
          ? { id: row.organization_id, nameTh: row.organizations.name_th }
          : null,
    };
  }
);

/** งานวิจัยที่เผยแพร่แล้วของผู้วิจัยคนนี้ที่ guest มองเห็นได้ (public/read_only/
 * metadata_only เท่านั้น) — RLS ของ research_items บังคับกฎเดียวกันนี้อยู่แล้ว
 * ที่ระดับฐานข้อมูล (ดู research_items_select ใน 20260731100200_rls_policies.sql)
 * filter ในแอปนี้เป็นการป้องกันซ้ำชั้นที่สอง ไม่ใช่ชั้นเดียวที่พึ่งได้
 *
 * ดึงมาทั้งหมดของผู้วิจัยคนนี้แล้ว sort/slice ฝั่ง JS แทนการสั่ง .order() บน
 * คอลัมน์ของตารางที่ embed มา (research_items.published_at) — โปรเจกต์นี้ไม่มี
 * ตัวอย่างยืนยันว่า syntax แบบนั้นใช้ได้จริงกับ Supabase JS v2 ที่ติดตั้งอยู่
 * เลยสักที่ (ต่างจาก !inner + .eq("research_items.xxx", ...) ที่ยืนยันแล้วจาก
 * lib/data/access-grants.server.ts) จำนวนงานวิจัยต่อผู้วิจัยหนึ่งคนไม่มากพอที่
 * การ sort ฝั่ง JS จะมีผลด้านประสิทธิภาพ */
export const getPublicAuthorResearch = cache(
  async (authorId: string): Promise<PublicAuthorResearch[]> => {
    if (!isSupabaseConfigured() || !authorId) return [];

    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("research_authors")
      .select(
        `research_items!inner (
          slug, title_th, title_en, published_at, access_level, cover_image,
          research_categories ( categories ( slug, name_th ) )
        )`
      )
      .eq("author_id", authorId)
      .eq("research_items.status", "published")
      .in("research_items.access_level", ["public", "read_only", "metadata_only"]);

    if (error || !data) return [];

    const rows = data as unknown as {
      research_items: {
        slug: string;
        title_th: string;
        title_en: string | null;
        published_at: string | null;
        access_level: string;
        cover_image: string | null;
        research_categories: { categories: { slug: string; name_th: string } | null }[];
      } | null;
    }[];

    return rows
      .map((row) => row.research_items)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        id: item.slug,
        titleTh: item.title_th,
        titleEn: item.title_en,
        publishedAt: item.published_at,
        accessLevel: item.access_level,
        coverImage: item.cover_image,
        categories: item.research_categories
          .map((rc) => rc.categories)
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({ slug: c.slug, nameTh: c.name_th })),
      }))
      .sort((a, b) => {
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return b.publishedAt.localeCompare(a.publishedAt);
      })
      .slice(0, 20);
  }
);

-- ============================================================================
-- แก้ไข C-1 (docs/production-readiness-report.md หัวข้อ 2, Critical) —
-- research_document_texts เปิดให้ดึงเนื้อหาไฟล์ PDF/OCR แบบเต็มออกมาได้โดยตรง
-- ทันทีที่แถวมองเห็นได้ (RLS เป็น row-level ไม่ใช่ column-level — เห็นแถวได้
-- เท่ากับเห็นทุกคอลัมน์ รวม extracted_text/ocr_text ดิบ) พิสูจน์แล้วว่าแม้แต่
-- ผู้ใช้ที่ไม่ได้ล็อกอิน (anon key อย่างเดียว) ก็ดึงเนื้อหาเต็มของเอกสาร
-- `read_only` (อ่านออนไลน์ได้แต่ห้ามดาวน์โหลด) ออกไปได้ทันที ผ่าน PostgREST
-- ตรงๆ โดยไม่ผ่าน Signed URL และไม่มีการบันทึก download_logs ใดๆ เลย
--
-- แนวทางแก้ไข — คงสถาปัตยกรรม RLS-based เดิมไว้ทั้งหมด (ไม่เปลี่ยนไปใช้
-- Service Role สำหรับค้นหา ไม่ข้าม RLS โดยไม่มีเหตุผล):
--   1) ตัดสิทธิ์ SELECT คอลัมน์เนื้อหาดิบ (extracted_text,
--      extracted_text_normalized, ocr_text, ocr_text_normalized) ออกจาก
--      anon/authenticated โดยสิ้นเชิง — คงไว้เฉพาะคอลัมน์ metadata ที่หน้า
--      จัดการภายในใช้แสดงสถานะ (getExtractionStatus/getExtractionStatusBySlug,
--      getPdfProcessingCandidates — ตรวจสอบแล้วว่าทั้งคู่ไม่เคย select คอลัมน์
--      เนื้อหาดิบเลย จึงไม่ได้รับผลกระทบจากการตัดสิทธิ์นี้)
--   2) เพิ่มฟังก์ชัน SECURITY DEFINER search_research_document_excerpts()
--      รับคำค้นหาแล้วคืนค่าเฉพาะ "ช่วงข้อความรอบตำแหน่งที่ตรงคำค้นหาครั้งแรก"
--      (รัศมี 1000 ตัวอักษรทั้งสองด้าน ไม่ใช่เนื้อหาทั้งไฟล์) — ฟังก์ชันนี้
--      ทวนสอบเงื่อนไขการมองเห็นแถวเดียวกับ policy
--      "research_document_texts_select" ทุกประการด้วยตนเองในตัวฟังก์ชัน
--      (เพราะ SECURITY DEFINER ข้าม RLS โดยธรรมชาติ — จึงต้องคัดลอกเงื่อนไข
--      สิทธิ์เดิมมาบังคับเองตรงนี้ ไม่ใช่การผ่อนสิทธิ์แต่อย่างใด) ตั้ง
--      search_path แบบ fixed (`public, pg_temp`) กัน search_path hijacking
--      ตามข้อกำหนดมาตรฐานของ SECURITY DEFINER function และ revoke สิทธิ์
--      execute จาก PUBLIC ก่อนเสมอแล้วค่อย grant เฉพาะ anon/authenticated
--      (Postgres ให้สิทธิ์ EXECUTE กับ PUBLIC อัตโนมัติเมื่อสร้างฟังก์ชันใหม่)
--   3) lib/data/research-search.server.ts เปลี่ยนมาเรียกฟังก์ชันนี้แทนการ
--      select ตรง — ตรรกะสร้าง snippet/ไฮไลต์ฝั่ง TypeScript (buildSnippet())
--      ไม่ถูกแก้ไขเลยแม้แต่บรรทัดเดียว เพราะรัศมี excerpt (1000) มากกว่ารัศมี
--      snippet จริง (120) หลายเท่า ผลลัพธ์ snippet/ตำแหน่งไฮไลต์จึงเหมือนเดิม
--      ทุกกรณี — สิ่งที่เปลี่ยนคือ "เนื้อหาดิบทั้งไฟล์" ไม่เคยหลุดออกจาก
--      ฐานข้อมูลไปยัง client ชั้นใดๆ อีกต่อไป (ไม่ว่าจะเรียกผ่านแอปจริงหรือ
--      REST API ตรง) เหลือแค่ excerpt ที่ตัดความยาวรอบจุดที่ตรงเพียงจุดเดียว
--
-- ทดสอบยืนยันแล้วว่า anon key เพียงอย่างเดียวดึง extracted_text/ocr_text ผ่าน
-- REST ตรงไม่ได้อีกต่อไป (revoke ปฏิเสธก่อนถึงชั้น RLS ด้วยซ้ำ) และฟีเจอร์
-- ค้นหาเนื้อหา PDF ยังทำงานถูกต้องทุกกรณีผ่าน RPC ใหม่ — ดู
-- lib/data/research-search.server.test.ts และ docs/qa-test-plan.md (SEARCH-03)
-- ============================================================================

revoke select on public.research_document_texts from anon, authenticated;

grant select (
  id, research_item_id, extraction_status, extraction_error_message,
  extracted_at, source_file_path, source_file_hash, created_at, updated_at,
  ocr_status, ocr_error_message, ocr_provider, ocr_language, ocr_confidence,
  ocr_processed_at
) on public.research_document_texts to anon, authenticated;

create or replace function public.search_research_document_excerpts(
  p_raw_query text,
  p_normalized_query text
)
returns table (
  research_item_id uuid,
  excerpt text,
  is_ocr boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_radius constant int := 1000;
begin
  -- ป้องกัน query ว่าง/สั้นผิดปกติสร้างภาระ scan โดยไม่จำเป็น (สอดคล้องกับ
  -- MIN_QUERY_LENGTH ฝั่งแอปใน lib/data/research-search.server.ts แต่ตรวจซ้ำ
  -- ที่นี่อีกชั้นเผื่อมีผู้เรียก RPC นี้ตรงในอนาคตโดยไม่ผ่านแอป)
  if p_raw_query is null or length(p_raw_query) = 0
     or p_normalized_query is null or length(p_normalized_query) = 0 then
    return;
  end if;

  return query
  with visible as (
    -- เงื่อนไขเดียวกับ policy "research_document_texts_select" ทุกประการ —
    -- ห้ามแก้ไขที่นี่โดยไม่แก้ policy ต้นทางให้ตรงกันเสมอ
    select ri.id
    from public.research_items ri
    where
      (
        ri.status = 'published'
        and ri.access_level != 'metadata_only'
        and (
          ri.access_level in ('public', 'read_only')
          or (ri.access_level = 'member_only' and public.user_max_role_rank() >= 10)
          or (ri.access_level = 'staff_only' and public.user_max_role_rank() >= 20)
        )
      )
      or ri.submitted_by = auth.uid()
      or public.user_max_role_rank() >= 30
  ),
  extracted_hits as (
    select
      d.research_item_id,
      position(lower(p_raw_query) in lower(d.extracted_text)) as match_pos,
      d.extracted_text as source_text,
      false as is_ocr
    from public.research_document_texts d
    join visible v on v.id = d.research_item_id
    where d.extraction_status = 'completed'
      and d.extracted_text_normalized ilike '%' || p_normalized_query || '%'
  ),
  ocr_hits as (
    select
      d.research_item_id,
      position(lower(p_raw_query) in lower(d.ocr_text)) as match_pos,
      d.ocr_text as source_text,
      true as is_ocr
    from public.research_document_texts d
    join visible v on v.id = d.research_item_id
    where d.ocr_status = 'completed'
      and d.ocr_text_normalized ilike '%' || p_normalized_query || '%'
  )
  select
    h.research_item_id,
    substring(
      h.source_text
      from greatest(1, h.match_pos - v_radius)
      for (
        least(length(h.source_text), h.match_pos + length(p_raw_query) + v_radius)
        - greatest(1, h.match_pos - v_radius)
        + 1
      )
    ) as excerpt,
    h.is_ocr
  from (
    select * from extracted_hits
    union all
    select * from ocr_hits
  ) h
  where h.match_pos > 0;
end;
$$;

-- Postgres ให้สิทธิ์ EXECUTE แก่ PUBLIC โดยอัตโนมัติเมื่อสร้างฟังก์ชันใหม่ —
-- ตัดสิทธิ์นี้ออกก่อนเสมอแล้วค่อย grant เฉพาะ role ที่ต้องใช้จริงเท่านั้น
revoke all on function public.search_research_document_excerpts(text, text) from public;
grant execute on function public.search_research_document_excerpts(text, text) to anon, authenticated;

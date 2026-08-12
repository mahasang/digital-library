-- ============================================================================
-- แก้ finding M-1 (docs/production-readiness-report.md) ส่วนที่อยู่ในชั้น RPC —
-- search_research_document_excerpts() (เพิ่มใน 20260822100000 เพื่อแก้ C-1)
-- เดิมไม่มี ORDER BY ในคิวรีสุดท้าย — Postgres ไม่การันตีลำดับแถวที่คืนมาโดยไม่
-- มี ORDER BY แม้ยิง query เดิมซ้ำก็ตาม ทำให้ผลลัพธ์ที่ lib/data/
-- research-search.server.ts นำไปสร้าง candidates Map (ซึ่งกำหนดลำดับเริ่มต้น
-- ก่อนการเรียงลำดับฝั่งแอป) อาจมาในลำดับต่างกันระหว่างคำขอ — แม้ฝั่งแอปจะเรียง
-- ลำดับสุดท้ายแบบ deterministic แล้วเสมอ (relevance -> วันที่เผยแพร่ -> id ผ่าน
-- lib/search/rank.ts) แต่การเพิ่มความคงที่ในชั้น RPC เองด้วยเป็นการป้องกันอีก
-- ชั้น (defense in depth) และทำให้ debug ง่ายขึ้นเมื่อเทียบผล query ตรงๆ
--
-- **ไม่แก้ไขเงื่อนไขสิทธิ์/RLS ใดๆ ในไฟล์นี้เลย** — คัดลอกฟังก์ชันเดิมมาทั้งหมด
-- เปลี่ยนเฉพาะการเพิ่ม `order by` ท้ายสุดเท่านั้น เพื่อไม่ให้กระทบ regression
-- test ของ C-1 (lib/data/research-search-rls.integration.test.ts) แม้แต่จุดเดียว
-- ============================================================================

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
  if p_raw_query is null or length(p_raw_query) = 0
     or p_normalized_query is null or length(p_normalized_query) = 0 then
    return;
  end if;

  return query
  with visible as (
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
  where h.match_pos > 0
  -- ตัดสินลำดับด้วย research_item_id เสมอ (เทียบเท่า compareByIdAsc ฝั่งแอป
  -- ใน lib/search/rank.ts) — ไม่ใช่การเรียงตาม relevance ในชั้นนี้ (relevance
  -- คำนวณและเรียงลำดับที่ฝั่งแอปเท่านั้น ตาม matchSource ของแต่ละรายการ ซึ่ง
  -- RPC นี้ไม่รู้จัก) เพียงแค่ทำให้ "ลำดับแถวดิบที่ RPC คืนมา" คงที่ ไม่ขึ้นกับ
  -- แผนการ query ภายในของ Postgres ในแต่ละครั้งที่เรียก
  order by h.research_item_id, h.is_ocr;
end;
$$;

revoke all on function public.search_research_document_excerpts(text, text) from public;
grant execute on function public.search_research_document_excerpts(text, text) to anon, authenticated;

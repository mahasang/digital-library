-- ============================================================================
-- ปีที่เผยแพร่ (research_items.year): เปลี่ยนจาก พ.ศ. เป็น ค.ศ.
-- ============================================================================
-- เดิม: CHECK (year between 2400 and 2700) และข้อมูลเก็บเป็น พ.ศ.
-- ใหม่: เก็บเป็น ค.ศ. ช่วง 1000–2100 (ต้องตรงกับ SUBMISSION_YEAR_MIN/MAX ใน
--       lib/validation/submission.ts)
--
-- ลำดับใช้งานจริง: (1) รันไฟล์นี้ก่อน (2) แล้ว deploy เว็บเวอร์ชันที่รับ ค.ศ. ทันที
-- รันซ้ำได้ปลอดภัย: แปลงเฉพาะแถวที่ยังเป็น พ.ศ. (2400–2700) เท่านั้น
--
-- ข้อควรรู้
-- * trigger prevent_publish_unscanned_file ทำงานกับทุก UPDATE ของ research_items ถ้ามีงาน
--   ที่ "เผยแพร่แล้ว" แต่ scan_status เป็น pending/infected/error การแปลงจะ error และ
--   rollback ทั้งหมด (ข้อมูลไม่เสียหายครึ่งๆ กลางๆ) — ตรวจก่อนรันด้วย query (ก) ท้ายไฟล์
--   ต้องได้ 0 แถว ไฟล์นี้ไม่ปิด/ข้าม trigger ใดๆ
-- * trigger set_updated_at จะตั้ง updated_at ของทุกแถวเป็นเวลาที่รัน migration
-- ============================================================================

begin;

-- 1) ถอด CHECK เดิมของ year (หาจากนิยาม เผื่อชื่อ constraint ไม่ใช่ค่าปริยาย)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.research_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%year%'
      and pg_get_constraintdef(oid) ilike '%2400%'
  loop
    execute format('alter table public.research_items drop constraint %I', c.conname);
  end loop;
end
$$;

-- 2) แปลงข้อมูลเดิม พ.ศ. -> ค.ศ.
update public.research_items
set year = year - 543
where year between 2400 and 2700;

-- 3) CHECK ใหม่ (ค.ศ.) — ถอดชื่อเดิมก่อนเพื่อให้รันซ้ำได้
alter table public.research_items drop constraint if exists research_items_year_check;
alter table public.research_items
  add constraint research_items_year_check check (year between 1000 and 2100);

commit;

-- ----------------------------------------------------------------------------
-- (ก) ตรวจก่อนรัน — ต้องได้ 0 แถว:
--   select id, slug, scan_status from public.research_items
--   where status = 'published' and scan_status in ('pending', 'infected', 'error');
--
-- (ข) ตรวจหลังรัน — min/max ต้องอยู่ในช่วง 1000–2100 (งานปัจจุบันควรเป็น ~2020–2026):
--   select min(year), max(year), count(*) from public.research_items;
-- ----------------------------------------------------------------------------

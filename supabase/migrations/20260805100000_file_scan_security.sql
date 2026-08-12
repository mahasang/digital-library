-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 14: ความปลอดภัยไฟล์อัปโหลด
--
-- เพิ่ม:
--   1. คอลัมน์บันทึกผลตรวจสอบไฟล์ (magic-byte + malware scan) บน research_items
--   2. Backfill แถวเดิมทั้งหมด (อัปโหลดก่อนมีฟีเจอร์นี้) เป็น 'skipped' — ไม่ปิดกั้น
--      การใช้งานเอกสารที่เผยแพร่ไปแล้วก่อนหน้านี้
--   3. Trigger กันเผยแพร่เอกสารที่ไฟล์ยังไม่ผ่านการตรวจสอบ (ป้องกันสองชั้น
--      ร่วมกับการตรวจสอบฝั่ง Server Action ตอนอัปโหลด/สร้างแถวเอง)
--
-- หมายเหตุสถาปัตยกรรม: ไฟล์อัปโหลดตรงจาก Browser ไปยัง Supabase Storage เสมอ
-- (ดู docs/file-security.md) การตรวจสอบเนื้อไฟล์จริง (magic-byte/malware scan)
-- จึงเกิดขึ้นที่ Server Action **ก่อน insert/update แถว research_items** เท่านั้น
-- (ดาวน์โหลดไฟล์ที่เพิ่งอัปโหลดกลับมาตรวจด้วย Service Role แล้วค่อยบันทึกผล)
-- ไม่ใช่ background job — ดังนั้นแถวที่มีอยู่จริงในระบบควรมี scan_status =
-- 'clean'/'skipped' เสมอ (ไม่มี 'infected'/'error' ค้างอยู่จริง) ยกเว้นกรณี
-- แก้ไขข้อมูลตรงในฐานข้อมูลโดยไม่ผ่านแอป — trigger ด้านล่างจึงยังจำเป็นเป็น
-- ด่านสำรอง ไม่ใช่ด่านหลัก
-- ============================================================================

alter table public.research_items
  add column scan_status text not null default 'skipped'
    check (scan_status in ('clean', 'infected', 'error', 'skipped')),
  add column scanned_at timestamptz,
  add column scan_provider text,
  add column scan_reason text;

comment on column public.research_items.scan_status is
  'ผลการตรวจสอบไฟล์ล่าสุด (pdf_file เป็นหลัก): clean = สแกนแล้วปลอดภัย, infected = พบภัยคุกคาม, error = สแกนไม่สำเร็จ, skipped = ยังไม่ได้สแกนจริง (โหมดจำลองตอน dev หรือข้อมูลเก่าก่อนมีฟีเจอร์นี้)';
comment on column public.research_items.scanned_at is 'เวลาที่ตรวจสอบไฟล์ล่าสุด';
comment on column public.research_items.scan_provider is 'ผู้ให้บริการ/วิธีที่ใช้ตรวจสอบ เช่น clamav, http:<host>, mock-dev, legacy-pre-scan';
comment on column public.research_items.scan_reason is 'เหตุผลโดยย่อเมื่อ scan_status ไม่ใช่ clean (ไม่มีข้อมูลอ่อนไหว/ลับ)';

create index idx_research_items_scan_status on public.research_items (scan_status);

-- แถวเดิมทั้งหมด (อัปโหลดก่อนมีระบบตรวจสอบไฟล์) ถือว่า "ไม่เคยถูกสแกนจริง" อย่าง
-- ตรงไปตรงมา แต่ไม่ปิดกั้นการอ่าน/ดาวน์โหลด/คงสถานะเผยแพร่เดิม (ผ่านการตรวจสอบ
-- โดยมนุษย์ในขั้นตอนอนุมัติมาแล้ว) — ใช้ scan_provider แยกจาก mock-dev ของตอนนี้
-- ให้ทราบชัดเจนว่าเป็นข้อมูลเก่า ไม่ใช่ผลจากโหมดจำลอง
update public.research_items
set scan_status = 'skipped',
    scan_provider = 'legacy-pre-scan',
    scan_reason = 'อัปโหลดก่อนเปิดใช้งานระบบตรวจสอบไฟล์ (magic-byte/malware scan)',
    scanned_at = created_at;

-- ----------------------------------------------------------------------------
-- prevent_publish_unscanned_file(): กันเผยแพร่เอกสารที่ไฟล์ตรวจไม่ผ่าน/ยังไม่ผ่าน
-- การตรวจสอบ (ด่านสำรอง — ด่านหลักคือ Server Action ปฏิเสธการสร้างแถวตั้งแต่แรก
-- อยู่แล้วหากไฟล์ไม่ผ่าน จึงไม่ควรมีแถวจริงที่ scan_status = infected/error หลุด
-- มาถึงจุดนี้ได้ ยกเว้นมีการแก้ไขข้อมูลตรงในฐานข้อมูลโดยไม่ผ่านแอป)
-- ----------------------------------------------------------------------------
create or replace function public.prevent_publish_unscanned_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and new.scan_status in ('infected', 'error') then
    raise exception 'ไม่สามารถเผยแพร่งานวิจัยนี้ได้ เนื่องจากไฟล์ยังไม่ผ่านการตรวจสอบความปลอดภัย'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_publish_unscanned_file on public.research_items;
create trigger trg_prevent_publish_unscanned_file
  before update on public.research_items
  for each row execute function public.prevent_publish_unscanned_file();

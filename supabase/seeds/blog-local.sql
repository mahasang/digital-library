-- ============================================================================
-- LOCAL DEV ONLY — NEVER run on production
-- ============================================================================

-- ============================================================================
-- บทความ draft 1 รายการสำหรับทดสอบหน้า /blog-admin และ /blog-admin/[id]/edit
-- (e2e/accessibility.spec.ts หา id ของหน้าแก้ไขจากลิงก์ "แก้ไข" แรกในรายการ จึงต้องมีบทความอย่างน้อย 1 รายการ)
--
-- status = draft โดยตั้งใจ: ไม่แสดงในหน้า /blog สาธารณะ และไม่ส่งผลต่อหน้าอื่นที่ test ตรวจอยู่
-- author_id = NULL (คอลัมน์ nullable) เพื่อไม่ผูกกับบัญชีผู้ใช้ใด
--
-- idempotent: ON CONFLICT (slug) DO NOTHING — รันซ้ำแล้วไม่เพิ่มแถว
-- ============================================================================
insert into public.blog_posts (
  slug,
  title_lo, title_th, title_en, title_vi,
  excerpt_lo, excerpt_th, excerpt_en, excerpt_vi,
  content_lo, content_th, content_en, content_vi,
  status
) values (
  'local-seed-draft',
  'ບົດຄວາມຮ່າງສຳລັບທົດສອບ', 'บทความฉบับร่างสำหรับทดสอบ', 'Local seed draft post', 'Bài viết nháp để thử nghiệm',
  'ບົດຄວາມຮ່າງທີ່ໃຊ້ສຳລັບທົດສອບໜ້າຈັດການບົດຄວາມ', 'บทความฉบับร่างที่ใช้ทดสอบหน้าจัดการบทความ', 'A draft post used to exercise the blog admin pages.', 'Bài viết nháp dùng để kiểm thử trang quản trị blog.',
  '<p>ບົດຄວາມຮ່າງສຳລັບທົດສອບ</p>', '<p>บทความฉบับร่างสำหรับทดสอบ</p>', '<p>Local seed draft post.</p>', '<p>Bài viết nháp để thử nghiệm.</p>',
  'draft'
)
on conflict (slug) do nothing;

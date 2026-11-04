-- ชื่อหมวดหมู่ภาษาลาวและภาษาเวียดนาม
--
-- เป็น nullable และไม่มีค่า default: แถวเดิมไม่ถูกแก้ และหมวดหมู่ที่ยังไม่มีคำแปล
-- จะแสดงเป็นภาษาไทยผ่าน getCategoryName (lib/categoryName.ts) ไฟล์นี้เพิ่มเฉพาะ
-- คอลัมน์ ไม่ใส่คำแปล เพราะคำแปลต้องมาจากผู้ที่ใช้ภาษานั้นจริง
--
-- RLS เป็นระดับแถวและไม่มี grant รายคอลัมน์บน categories นโยบายเดิมจึงครอบคลุม
-- คอลัมน์ใหม่ trigger ของตารางนี้ไม่ได้อ้างถึงคอลัมน์ชื่อ

alter table public.categories
  add column if not exists name_lo text,
  add column if not exists name_vi text;

comment on column public.categories.name_lo is 'ชื่อหมวดหมู่ภาษาลาว (null = ยังไม่มีคำแปล แสดงเป็นภาษาไทย)';
comment on column public.categories.name_vi is 'ชื่อหมวดหมู่ภาษาเวียดนาม (null = ยังไม่มีคำแปล แสดงเป็นภาษาไทย)';

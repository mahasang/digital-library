-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 2: Reference Data
--
-- ข้อมูลอ้างอิงหลักที่ระบบต้องมีในทุกสภาพแวดล้อม (ไม่ใช่ข้อมูลตัวอย่างสาธิต)
-- ได้แก่ บทบาทผู้ใช้งาน และหมวดหมู่งานวิจัย (ต้องตรงกับ data/categories.ts
-- ฝั่งแอปพลิเคชัน เนื่องจากหน้าเว็บอ้างอิง categoryId/slug เดียวกัน)
-- ============================================================================

insert into public.roles (name, rank, description) values
  ('member', 10, 'สมาชิกที่ลงทะเบียนแล้ว อ่าน/ดาวน์โหลดงานวิจัยระดับสมาชิกได้'),
  ('staff', 20, 'บุคลากรขององค์กร เข้าถึงงานวิจัยระดับ staff_only และส่งงานวิจัยเข้าระบบได้'),
  ('librarian', 30, 'บรรณารักษ์ ตรวจสอบ/อนุมัติ/ขอแก้ไข/ปฏิเสธงานวิจัยที่ส่งเข้ามา'),
  ('admin', 40, 'ผู้ดูแลระบบ จัดการผู้ใช้ สิทธิ์ หมวดหมู่ และดูรายงานภาพรวมทั้งหมด');

insert into public.categories (slug, name_th, name_en, description, icon) values
  ('engineering', 'วิศวกรรมศาสตร์', 'Engineering', 'งานวิจัยด้านวิศวกรรมและเทคโนโลยีการผลิต', 'Cog'),
  ('it', 'เทคโนโลยีสารสนเทศ', 'Information Technology', 'งานวิจัยด้านคอมพิวเตอร์ ปัญญาประดิษฐ์ และซอฟต์แวร์', 'Cpu'),
  ('business', 'บริหารธุรกิจและเศรษฐศาสตร์', 'Business & Economics', 'งานวิจัยด้านการบริหารจัดการ การเงิน และเศรษฐศาสตร์', 'LineChart'),
  ('health', 'สาธารณสุขและการแพทย์', 'Public Health & Medicine', 'งานวิจัยด้านสุขภาพ การแพทย์ และสาธารณสุข', 'HeartPulse'),
  ('education', 'ศึกษาศาสตร์', 'Education', 'งานวิจัยด้านการเรียนการสอนและการพัฒนาหลักสูตร', 'GraduationCap'),
  ('social', 'สังคมศาสตร์และมนุษยศาสตร์', 'Social Sciences & Humanities', 'งานวิจัยด้านสังคม วัฒนธรรม และพฤติกรรมมนุษย์', 'Users'),
  ('agriculture', 'เกษตรและสิ่งแวดล้อม', 'Agriculture & Environment', 'งานวิจัยด้านการเกษตร ทรัพยากรธรรมชาติ และสิ่งแวดล้อม', 'Leaf'),
  ('science', 'วิทยาศาสตร์พื้นฐาน', 'Basic Science', 'งานวิจัยด้านวิทยาศาสตร์บริสุทธิ์และประยุกต์', 'FlaskConical');

insert into public.organizations (slug, name_th, name_en) values
  ('engineering-faculty', 'คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Engineering'),
  ('it-faculty', 'คณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Information Technology'),
  ('business-faculty', 'คณะบริหารธุรกิจและเศรษฐศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Business & Economics'),
  ('medicine-faculty', 'คณะแพทยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Medicine'),
  ('education-faculty', 'คณะศึกษาศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Education'),
  ('social-faculty', 'คณะสังคมศาสตร์และมนุษยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Social Sciences & Humanities'),
  ('agriculture-faculty', 'คณะเกษตรและสิ่งแวดล้อม มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Agriculture & Environment'),
  ('science-faculty', 'คณะวิทยาศาสตร์พื้นฐาน มหาวิทยาลัยเทคโนโลยีองค์กร', 'Faculty of Basic Science');

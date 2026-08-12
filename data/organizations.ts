import type { Organization } from "@/types/research";

/**
 * ข้อมูลหน่วยงานตัวอย่าง — ต้องตรงกับข้อมูลที่ seed ไว้ใน
 * supabase/migrations/20260731100300_seed_reference_data.sql
 * ใช้เป็น fallback เมื่อยังไม่ได้ตั้งค่า Supabase
 */
export const organizations: Organization[] = [
  {
    id: "engineering-faculty",
    slug: "engineering-faculty",
    nameTh: "คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Engineering",
  },
  {
    id: "it-faculty",
    slug: "it-faculty",
    nameTh: "คณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Information Technology",
  },
  {
    id: "business-faculty",
    slug: "business-faculty",
    nameTh: "คณะบริหารธุรกิจและเศรษฐศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Business & Economics",
  },
  {
    id: "medicine-faculty",
    slug: "medicine-faculty",
    nameTh: "คณะแพทยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Medicine",
  },
  {
    id: "education-faculty",
    slug: "education-faculty",
    nameTh: "คณะศึกษาศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Education",
  },
  {
    id: "social-faculty",
    slug: "social-faculty",
    nameTh: "คณะสังคมศาสตร์และมนุษยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Social Sciences & Humanities",
  },
  {
    id: "agriculture-faculty",
    slug: "agriculture-faculty",
    nameTh: "คณะเกษตรและสิ่งแวดล้อม มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Agriculture & Environment",
  },
  {
    id: "science-faculty",
    slug: "science-faculty",
    nameTh: "คณะวิทยาศาสตร์พื้นฐาน มหาวิทยาลัยเทคโนโลยีองค์กร",
    nameEn: "Faculty of Basic Science",
  },
];

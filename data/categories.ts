import type { Category } from "@/types/research";

export const categories: Category[] = [
  {
    id: "engineering",
    nameTh: "วิศวกรรมศาสตร์",
    nameEn: "Engineering",
    description: "งานวิจัยด้านวิศวกรรมและเทคโนโลยีการผลิต",
    icon: "Cog",
  },
  {
    id: "it",
    nameTh: "เทคโนโลยีสารสนเทศ",
    nameEn: "Information Technology",
    description: "งานวิจัยด้านคอมพิวเตอร์ ปัญญาประดิษฐ์ และซอฟต์แวร์",
    icon: "Cpu",
  },
  {
    id: "business",
    nameTh: "บริหารธุรกิจและเศรษฐศาสตร์",
    nameEn: "Business & Economics",
    description: "งานวิจัยด้านการบริหารจัดการ การเงิน และเศรษฐศาสตร์",
    icon: "LineChart",
  },
  {
    id: "health",
    nameTh: "สาธารณสุขและการแพทย์",
    nameEn: "Public Health & Medicine",
    description: "งานวิจัยด้านสุขภาพ การแพทย์ และสาธารณสุข",
    icon: "HeartPulse",
  },
  {
    id: "education",
    nameTh: "ศึกษาศาสตร์",
    nameEn: "Education",
    description: "งานวิจัยด้านการเรียนการสอนและการพัฒนาหลักสูตร",
    icon: "GraduationCap",
  },
  {
    id: "social",
    nameTh: "สังคมศาสตร์และมนุษยศาสตร์",
    nameEn: "Social Sciences & Humanities",
    description: "งานวิจัยด้านสังคม วัฒนธรรม และพฤติกรรมมนุษย์",
    icon: "Users",
  },
  {
    id: "agriculture",
    nameTh: "เกษตรและสิ่งแวดล้อม",
    nameEn: "Agriculture & Environment",
    description: "งานวิจัยด้านการเกษตร ทรัพยากรธรรมชาติ และสิ่งแวดล้อม",
    icon: "Leaf",
  },
  {
    id: "science",
    nameTh: "วิทยาศาสตร์พื้นฐาน",
    nameEn: "Basic Science",
    description: "งานวิจัยด้านวิทยาศาสตร์บริสุทธิ์และประยุกต์",
    icon: "FlaskConical",
  },
];

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

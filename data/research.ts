import type { ResearchItem } from "@/types/research";

export const researchItems: ResearchItem[] = [
  {
    id: "eng-2024-001",
    titleTh:
      "การพัฒนาระบบตรวจสอบโครงสร้างสะพานด้วยเซนเซอร์ไร้สายและการเรียนรู้ของเครื่อง",
    titleEn:
      "Development of Bridge Structural Health Monitoring System Using Wireless Sensors and Machine Learning",
    researchers: [
      { name: "ผศ.ดร.สมชาย วัฒนกุล", organization: "คณะวิศวกรรมศาสตร์" },
      { name: "นายกิตติพงษ์ เจริญสุข", organization: "คณะวิศวกรรมศาสตร์" },
    ],
    organization: "คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2567,
    categoryId: "engineering",
    keywords: ["โครงสร้างสะพาน", "เซนเซอร์ไร้สาย", "การเรียนรู้ของเครื่อง", "IoT"],
    abstract:
      "งานวิจัยนี้นำเสนอการออกแบบและพัฒนาระบบตรวจสอบสุขภาพโครงสร้างสะพานแบบเรียลไทม์ โดยใช้เครือข่ายเซนเซอร์ไร้สายร่วมกับแบบจำลองการเรียนรู้ของเครื่องเพื่อวิเคราะห์แนวโน้มความเสียหายของโครงสร้าง ผลการทดลองแสดงให้เห็นว่าระบบสามารถตรวจจับความผิดปกติได้อย่างแม่นยำและช่วยลดค่าใช้จ่ายในการบำรุงรักษาเชิงป้องกันได้อย่างมีนัยสำคัญ",
    coverImage: "/covers/cover-01.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 128,
    accessLevel: "public",
    status: "published",
    views: 2340,
    downloads: 512,
    publishedAt: "2567-02-15",
    scanStatus: "clean",
  },
  {
    id: "it-2024-002",
    titleTh: "การประยุกต์ใช้โมเดลภาษาขนาดใหญ่สำหรับการสรุปเอกสารราชการภาษาไทย",
    titleEn:
      "Applying Large Language Models for Thai Government Document Summarization",
    researchers: [
      { name: "ดร.ปิยะดา สุขสวัสดิ์", organization: "คณะเทคโนโลยีสารสนเทศ" },
    ],
    organization: "คณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2568,
    categoryId: "it",
    keywords: ["โมเดลภาษาขนาดใหญ่", "การประมวลผลภาษาธรรมชาติ", "การสรุปข้อความ", "AI"],
    abstract:
      "การศึกษานี้มุ่งเน้นการประเมินประสิทธิภาพของโมเดลภาษาขนาดใหญ่ในการสรุปเอกสารราชการภาษาไทยที่มีความซับซ้อนทางโครงสร้างและศัพท์เฉพาะ ผลการวิจัยพบว่าการปรับแต่งโมเดลด้วยชุดข้อมูลเฉพาะทางช่วยเพิ่มความแม่นยำของบทสรุปได้มากกว่าร้อยละ 20 เมื่อเทียบกับโมเดลพื้นฐาน",
    coverImage: "/covers/cover-02.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 96,
    accessLevel: "member_only",
    status: "published",
    views: 4180,
    downloads: 980,
    publishedAt: "2568-01-10",
    scanStatus: "clean",
  },
  {
    id: "biz-2024-003",
    titleTh: "ปัจจัยที่ส่งผลต่อการตัดสินใจลงทุนในกองทุนรวมยั่งยืนของนักลงทุนรายย่อย",
    titleEn:
      "Factors Affecting Retail Investors' Decisions to Invest in Sustainable Mutual Funds",
    researchers: [
      { name: "รศ.ดร.ณัฐพล ไชยเจริญ", organization: "คณะบริหารธุรกิจ" },
      { name: "นางสาวพิมพ์ชนก ศรีสุข", organization: "คณะบริหารธุรกิจ" },
    ],
    organization: "คณะบริหารธุรกิจและเศรษฐศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2566,
    categoryId: "business",
    keywords: ["การลงทุนยั่งยืน", "กองทุนรวม", "พฤติกรรมนักลงทุน", "ESG"],
    abstract:
      "งานวิจัยนี้ศึกษาปัจจัยเชิงจิตวิทยาและเศรษฐกิจที่มีผลต่อการตัดสินใจลงทุนในกองทุนรวมที่เน้นความยั่งยืน (ESG) ของนักลงทุนรายย่อยในประเทศไทย โดยใช้แบบสอบถามจากกลุ่มตัวอย่าง 400 คน ผลการวิจัยชี้ให้เห็นว่าความตระหนักด้านสิ่งแวดล้อมและความเชื่อมั่นต่อผลตอบแทนระยะยาวเป็นปัจจัยสำคัญที่สุด",
    coverImage: "/covers/cover-03.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 152,
    accessLevel: "public",
    status: "published",
    views: 1875,
    downloads: 430,
    publishedAt: "2566-11-02",
    scanStatus: "clean",
  },
  {
    id: "health-2024-004",
    titleTh: "ผลของโปรแกรมส่งเสริมสุขภาพจิตต่อระดับความเครียดของบุคลากรทางการแพทย์",
    titleEn:
      "Effects of a Mental Health Promotion Program on Stress Levels Among Healthcare Workers",
    researchers: [
      { name: "ผศ.พญ.กนกวรรณ ธนสาร", organization: "คณะแพทยศาสตร์" },
    ],
    organization: "คณะแพทยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2567,
    categoryId: "health",
    keywords: ["สุขภาพจิต", "ความเครียด", "บุคลากรทางการแพทย์", "โปรแกรมส่งเสริมสุขภาพ"],
    abstract:
      "การศึกษาเชิงทดลองนี้มีวัตถุประสงค์เพื่อประเมินผลของโปรแกรมส่งเสริมสุขภาพจิตแบบกลุ่มต่อระดับความเครียดของบุคลากรทางการแพทย์ในโรงพยาบาลระดับตติยภูมิ ผลการศึกษาพบว่ากลุ่มที่เข้าร่วมโปรแกรมมีระดับความเครียดลดลงอย่างมีนัยสำคัญทางสถิติเมื่อเทียบกับกลุ่มควบคุม",
    coverImage: "/covers/cover-04.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 84,
    accessLevel: "staff_only",
    status: "published",
    views: 960,
    downloads: 145,
    publishedAt: "2567-05-20",
    scanStatus: "clean",
  },
  {
    id: "edu-2024-005",
    titleTh: "การจัดการเรียนรู้แบบผสมผสานเพื่อพัฒนาทักษะการคิดวิเคราะห์ของนักศึกษาระดับปริญญาตรี",
    titleEn:
      "Blended Learning Management to Develop Critical Thinking Skills Among Undergraduate Students",
    researchers: [
      { name: "ดร.สุพัตรา เรืองวิทย์", organization: "คณะศึกษาศาสตร์" },
      { name: "นายอนุชา พงษ์ไพบูลย์", organization: "คณะศึกษาศาสตร์" },
    ],
    organization: "คณะศึกษาศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2565,
    categoryId: "education",
    keywords: ["การเรียนรู้แบบผสมผสาน", "ทักษะการคิดวิเคราะห์", "การจัดการเรียนการสอน"],
    abstract:
      "งานวิจัยนี้ออกแบบและทดลองใช้รูปแบบการจัดการเรียนรู้แบบผสมผสานระหว่างการเรียนในชั้นเรียนและออนไลน์ เพื่อพัฒนาทักษะการคิดวิเคราะห์ของนักศึกษาระดับปริญญาตรี ผลการวิจัยพบว่านักศึกษาที่เรียนด้วยรูปแบบผสมผสานมีคะแนนทักษะการคิดวิเคราะห์สูงกว่ากลุ่มที่เรียนแบบปกติอย่างมีนัยสำคัญ",
    coverImage: "/covers/cover-05.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 110,
    accessLevel: "read_only",
    status: "published",
    views: 1420,
    downloads: 0,
    publishedAt: "2565-08-30",
    scanStatus: "clean",
  },
  {
    id: "social-2024-006",
    titleTh: "การเปลี่ยนแปลงพฤติกรรมการบริโภคสื่อของคนรุ่น Gen Z ในยุคดิจิทัล",
    titleEn:
      "Changing Media Consumption Behavior of Generation Z in the Digital Era",
    researchers: [
      { name: "ผศ.ดร.ธีรภัทร มั่นคง", organization: "คณะสังคมศาสตร์" },
    ],
    organization: "คณะสังคมศาสตร์และมนุษยศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2568,
    categoryId: "social",
    keywords: ["Generation Z", "พฤติกรรมผู้บริโภค", "สื่อดิจิทัล", "โซเชียลมีเดีย"],
    abstract:
      "การวิจัยเชิงคุณภาพนี้ศึกษาการเปลี่ยนแปลงพฤติกรรมการบริโภคสื่อของกลุ่มคนรุ่น Gen Z ผ่านการสัมภาษณ์เชิงลึกและการสังเกตพฤติกรรมบนแพลตฟอร์มโซเชียลมีเดีย ผลการศึกษาชี้ให้เห็นแนวโน้มการบริโภคเนื้อหาแบบสั้นและปฏิสัมพันธ์แบบเรียลไทม์ที่เพิ่มขึ้นอย่างต่อเนื่อง",
    coverImage: "/covers/cover-06.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 76,
    accessLevel: "public",
    status: "published",
    views: 3210,
    downloads: 720,
    publishedAt: "2568-03-05",
    scanStatus: "clean",
  },
  {
    id: "agri-2024-007",
    titleTh: "การใช้โดรนเพื่อประเมินความสมบูรณ์ของแปลงนาข้าวด้วยภาพถ่ายมัลติสเปกตรัม",
    titleEn:
      "Using Drones to Assess Rice Field Health via Multispectral Imagery",
    researchers: [
      { name: "ดร.วิภาวี ทองใบ", organization: "คณะเกษตรศาสตร์" },
      { name: "นายศักดิ์ดา บุญมาก", organization: "คณะเกษตรศาสตร์" },
    ],
    organization: "คณะเกษตรและสิ่งแวดล้อม มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2566,
    categoryId: "agriculture",
    keywords: ["โดรนเกษตร", "ภาพถ่ายมัลติสเปกตรัม", "นาข้าว", "เกษตรแม่นยำ"],
    abstract:
      "งานวิจัยนี้พัฒนากระบวนการใช้โดรนติดกล้องมัลติสเปกตรัมเพื่อประเมินดัชนีความสมบูรณ์ของพืช (NDVI) ในแปลงนาข้าว และเปรียบเทียบกับการสำรวจภาคสนามแบบดั้งเดิม ผลการศึกษาพบว่าวิธีการนี้สามารถลดระยะเวลาการสำรวจได้มากกว่าร้อยละ 70 และมีความแม่นยำใกล้เคียงกับวิธีดั้งเดิม",
    coverImage: "/covers/cover-07.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 102,
    accessLevel: "member_only",
    status: "published",
    views: 1560,
    downloads: 310,
    publishedAt: "2566-06-18",
    scanStatus: "clean",
  },
  {
    id: "sci-2024-008",
    titleTh: "การสังเคราะห์วัสดุนาโนคาร์บอนจากชีวมวลเหลือทิ้งทางการเกษตรเพื่อการดูดซับโลหะหนัก",
    titleEn:
      "Synthesis of Carbon Nanomaterials from Agricultural Waste Biomass for Heavy Metal Adsorption",
    researchers: [
      { name: "รศ.ดร.มนตรี ศรีวิไล", organization: "คณะวิทยาศาสตร์" },
    ],
    organization: "คณะวิทยาศาสตร์พื้นฐาน มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2567,
    categoryId: "science",
    keywords: ["วัสดุนาโนคาร์บอน", "ชีวมวล", "การดูดซับโลหะหนัก", "เคมีสิ่งแวดล้อม"],
    abstract:
      "งานวิจัยนี้นำเสนอกระบวนการสังเคราะห์วัสดุนาโนคาร์บอนจากเปลือกข้าวและซังข้าวโพดซึ่งเป็นชีวมวลเหลือทิ้งทางการเกษตร เพื่อใช้เป็นวัสดุดูดซับโลหะหนักในน้ำเสีย ผลการทดลองพบว่าวัสดุที่พัฒนาขึ้นมีประสิทธิภาพการดูดซับตะกั่วและแคดเมียมสูงกว่าถ่านกัมมันต์เชิงพาณิชย์",
    coverImage: "/covers/cover-08.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 140,
    accessLevel: "public",
    status: "published",
    views: 2010,
    downloads: 605,
    publishedAt: "2567-09-12",
    scanStatus: "clean",
  },
  {
    id: "eng-2024-009",
    titleTh: "การออกแบบระบบผลิตไฟฟ้าจากพลังงานแสงอาทิตย์แบบติดตามดวงอาทิตย์สองแกนต้นทุนต่ำ",
    titleEn:
      "Design of a Low-Cost Dual-Axis Solar Tracking Power Generation System",
    researchers: [
      { name: "ผศ.ดร.ประเสริฐ วงศ์สกุล", organization: "คณะวิศวกรรมศาสตร์" },
    ],
    organization: "คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2568,
    categoryId: "engineering",
    keywords: ["พลังงานแสงอาทิตย์", "ระบบติดตามดวงอาทิตย์", "พลังงานทดแทน"],
    abstract:
      "งานวิจัยนี้ออกแบบและสร้างต้นแบบระบบติดตามดวงอาทิตย์แบบสองแกนต้นทุนต่ำสำหรับแผงโซลาร์เซลล์ขนาดครัวเรือน โดยใช้เซนเซอร์แสงและไมโครคอนโทรลเลอร์ราคาประหยัด ผลการทดสอบพบว่าระบบสามารถเพิ่มประสิทธิภาพการผลิตไฟฟ้าได้เฉลี่ยร้อยละ 28 เมื่อเทียบกับแผงแบบติดตั้งคงที่",
    coverImage: "/covers/cover-09.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 118,
    accessLevel: "public",
    status: "published",
    views: 2870,
    downloads: 690,
    publishedAt: "2568-02-01",
    scanStatus: "clean",
  },
  {
    id: "it-2024-010",
    titleTh: "ระบบตรวจจับการโจมตีทางไซเบอร์ในเครือข่าย IoT ด้วยเทคนิคการเรียนรู้เชิงลึก",
    titleEn:
      "Cyberattack Detection System for IoT Networks Using Deep Learning Techniques",
    researchers: [
      { name: "ดร.ชนากานต์ ทิพย์วงศ์", organization: "คณะเทคโนโลยีสารสนเทศ" },
      { name: "นายภาณุพงศ์ แสงทอง", organization: "คณะเทคโนโลยีสารสนเทศ" },
    ],
    organization: "คณะเทคโนโลยีสารสนเทศ มหาวิทยาลัยเทคโนโลยีองค์กร",
    year: 2566,
    categoryId: "it",
    keywords: ["ความมั่นคงปลอดภัยไซเบอร์", "IoT", "การเรียนรู้เชิงลึก", "การตรวจจับการบุกรุก"],
    abstract:
      "งานวิจัยนี้พัฒนาระบบตรวจจับการโจมตีทางไซเบอร์สำหรับเครือข่ายอุปกรณ์ IoT โดยใช้แบบจำลองโครงข่ายประสาทเทียมเชิงลึก (Deep Learning) ในการวิเคราะห์รูปแบบการจราจรเครือข่ายที่ผิดปกติ ผลการทดสอบกับชุดข้อมูลมาตรฐานแสดงความแม่นยำในการตรวจจับสูงถึงร้อยละ 97.8",
    coverImage: "/covers/cover-10.svg",
    pdfFile: "/mock-pdfs/sample.pdf",
    pageCount: 134,
    accessLevel: "staff_only",
    status: "published",
    views: 1980,
    downloads: 275,
    publishedAt: "2566-12-22",
    scanStatus: "clean",
  },
];

export function getResearchById(id: string): ResearchItem | undefined {
  return researchItems.find((r) => r.id === id);
}

export function getPublishedResearch(): ResearchItem[] {
  return researchItems.filter((r) => r.status === "published");
}

export function getLatestResearch(limit = 4): ResearchItem[] {
  return [...getPublishedResearch()]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, limit);
}

export function getPopularResearch(limit = 4): ResearchItem[] {
  return [...getPublishedResearch()]
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export function getRelatedResearch(item: ResearchItem, limit = 3): ResearchItem[] {
  return getPublishedResearch()
    .filter(
      (r) => r.id !== item.id && r.categoryId === item.categoryId
    )
    .slice(0, limit);
}

-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — ข้อมูลตัวอย่างสำหรับทดสอบ
--
-- ไฟล์นี้แปลงข้อมูลตัวอย่างชุดเดียวกับ data/research.ts (10 รายการ) ให้เป็น
-- ข้อมูลจริงในฐานข้อมูล Supabase สำหรับใช้ทดสอบ/สาธิตระบบเท่านั้น
-- ไม่ใช่ข้อมูลอ้างอิงที่จำเป็นต่อการทำงานของระบบ (ต่างจาก
-- 20260731100300_seed_reference_data.sql ที่เป็น roles/categories/organizations)
--
-- วิธีรัน:
--   - Local (Supabase CLI): `supabase db reset` จะรัน migrations แล้วรันไฟล์นี้ต่ออัตโนมัติ
--   - Remote/Production: `psql "$DATABASE_URL" -f supabase/seed.sql`
--     (ต้องรัน migrations ทั้งหมดใน supabase/migrations ก่อนเสมอ)
--
-- หมายเหตุ: สคริปต์นี้ไม่ได้สร้างผู้ใช้ระบบ (auth.users/profiles) ให้ เนื่องจาก
-- บัญชีผู้ใช้ต้องสมัครผ่าน Supabase Auth เท่านั้น (ดูขั้นตอนใน README.md)
--
-- หมายเหตุด้านเทคนิค: ไฟล์นี้เขียนเป็น "DO block" เดียว (ไม่ใช่ CREATE FUNCTION
-- แยกแล้วค่อย SELECT เรียก) โดยตั้งใจ — Supabase CLI ส่ง SQL ผ่าน connection
-- pooler ซึ่งอาจแยกแต่ละ statement ไปคนละ backend session กันได้ ทำให้ฟังก์ชัน
-- ที่เพิ่งสร้างในตอนต้นไฟล์ยังไม่ถูกมองเห็น/ยืนยัน (commit) ทันเวลาที่ statement
-- ถัดไปเรียกใช้ เกิด error "function ... does not exist" การรวมทุกอย่างไว้ใน
-- DO block เดียวทำให้ทั้งหมดเป็น "หนึ่ง statement" ที่ส่งและรันในคำขอเดียว
-- จึงไม่ขึ้นกับว่าคำขอถัดไปจะถูก route ไปคนละ session หรือไม่
-- ============================================================================

do $$
declare
  v_items jsonb := $seed$
  [
    {
      "slug": "eng-2024-001",
      "title_th": "การพัฒนาระบบตรวจสอบโครงสร้างสะพานด้วยเซนเซอร์ไร้สายและการเรียนรู้ของเครื่อง",
      "title_en": "Development of Bridge Structural Health Monitoring System Using Wireless Sensors and Machine Learning",
      "org_slug": "engineering-faculty",
      "year": 2567,
      "abstract": "งานวิจัยนี้นำเสนอการออกแบบและพัฒนาระบบตรวจสอบสุขภาพโครงสร้างสะพานแบบเรียลไทม์ โดยใช้เครือข่ายเซนเซอร์ไร้สายร่วมกับแบบจำลองการเรียนรู้ของเครื่องเพื่อวิเคราะห์แนวโน้มความเสียหายของโครงสร้าง ผลการทดลองแสดงให้เห็นว่าระบบสามารถตรวจจับความผิดปกติได้อย่างแม่นยำและช่วยลดค่าใช้จ่ายในการบำรุงรักษาเชิงป้องกันได้อย่างมีนัยสำคัญ",
      "cover": "/covers/cover-01.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 128,
      "access": "public",
      "status": "published",
      "views": 2340,
      "downloads": 512,
      "published_at": "2024-02-15T00:00:00+07:00",
      "categories": ["engineering"],
      "keywords": ["โครงสร้างสะพาน", "เซนเซอร์ไร้สาย", "การเรียนรู้ของเครื่อง", "IoT"],
      "authors": [
        {"name": "ผศ.ดร.สมชาย วัฒนกุล", "org_slug": "engineering-faculty"},
        {"name": "นายกิตติพงษ์ เจริญสุข", "org_slug": "engineering-faculty"}
      ]
    },
    {
      "slug": "it-2024-002",
      "title_th": "การประยุกต์ใช้โมเดลภาษาขนาดใหญ่สำหรับการสรุปเอกสารราชการภาษาไทย",
      "title_en": "Applying Large Language Models for Thai Government Document Summarization",
      "org_slug": "it-faculty",
      "year": 2568,
      "abstract": "การศึกษานี้มุ่งเน้นการประเมินประสิทธิภาพของโมเดลภาษาขนาดใหญ่ในการสรุปเอกสารราชการภาษาไทยที่มีความซับซ้อนทางโครงสร้างและศัพท์เฉพาะ ผลการวิจัยพบว่าการปรับแต่งโมเดลด้วยชุดข้อมูลเฉพาะทางช่วยเพิ่มความแม่นยำของบทสรุปได้มากกว่าร้อยละ 20 เมื่อเทียบกับโมเดลพื้นฐาน",
      "cover": "/covers/cover-02.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 96,
      "access": "member_only",
      "status": "published",
      "views": 4180,
      "downloads": 980,
      "published_at": "2025-01-10T00:00:00+07:00",
      "categories": ["it"],
      "keywords": ["โมเดลภาษาขนาดใหญ่", "การประมวลผลภาษาธรรมชาติ", "การสรุปข้อความ", "AI"],
      "authors": [
        {"name": "ดร.ปิยะดา สุขสวัสดิ์", "org_slug": "it-faculty"}
      ]
    },
    {
      "slug": "biz-2024-003",
      "title_th": "ปัจจัยที่ส่งผลต่อการตัดสินใจลงทุนในกองทุนรวมยั่งยืนของนักลงทุนรายย่อย",
      "title_en": "Factors Affecting Retail Investors' Decisions to Invest in Sustainable Mutual Funds",
      "org_slug": "business-faculty",
      "year": 2566,
      "abstract": "งานวิจัยนี้ศึกษาปัจจัยเชิงจิตวิทยาและเศรษฐกิจที่มีผลต่อการตัดสินใจลงทุนในกองทุนรวมที่เน้นความยั่งยืน (ESG) ของนักลงทุนรายย่อยในประเทศไทย โดยใช้แบบสอบถามจากกลุ่มตัวอย่าง 400 คน ผลการวิจัยชี้ให้เห็นว่าความตระหนักด้านสิ่งแวดล้อมและความเชื่อมั่นต่อผลตอบแทนระยะยาวเป็นปัจจัยสำคัญที่สุด",
      "cover": "/covers/cover-03.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 152,
      "access": "public",
      "status": "published",
      "views": 1875,
      "downloads": 430,
      "published_at": "2023-11-02T00:00:00+07:00",
      "categories": ["business"],
      "keywords": ["การลงทุนยั่งยืน", "กองทุนรวม", "พฤติกรรมนักลงทุน", "ESG"],
      "authors": [
        {"name": "รศ.ดร.ณัฐพล ไชยเจริญ", "org_slug": "business-faculty"},
        {"name": "นางสาวพิมพ์ชนก ศรีสุข", "org_slug": "business-faculty"}
      ]
    },
    {
      "slug": "health-2024-004",
      "title_th": "ผลของโปรแกรมส่งเสริมสุขภาพจิตต่อระดับความเครียดของบุคลากรทางการแพทย์",
      "title_en": "Effects of a Mental Health Promotion Program on Stress Levels Among Healthcare Workers",
      "org_slug": "medicine-faculty",
      "year": 2567,
      "abstract": "การศึกษาเชิงทดลองนี้มีวัตถุประสงค์เพื่อประเมินผลของโปรแกรมส่งเสริมสุขภาพจิตแบบกลุ่มต่อระดับความเครียดของบุคลากรทางการแพทย์ในโรงพยาบาลระดับตติยภูมิ ผลการศึกษาพบว่ากลุ่มที่เข้าร่วมโปรแกรมมีระดับความเครียดลดลงอย่างมีนัยสำคัญทางสถิติเมื่อเทียบกับกลุ่มควบคุม",
      "cover": "/covers/cover-04.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 84,
      "access": "staff_only",
      "status": "published",
      "views": 960,
      "downloads": 145,
      "published_at": "2024-05-20T00:00:00+07:00",
      "categories": ["health"],
      "keywords": ["สุขภาพจิต", "ความเครียด", "บุคลากรทางการแพทย์", "โปรแกรมส่งเสริมสุขภาพ"],
      "authors": [
        {"name": "ผศ.พญ.กนกวรรณ ธนสาร", "org_slug": "medicine-faculty"}
      ]
    },
    {
      "slug": "edu-2024-005",
      "title_th": "การจัดการเรียนรู้แบบผสมผสานเพื่อพัฒนาทักษะการคิดวิเคราะห์ของนักศึกษาระดับปริญญาตรี",
      "title_en": "Blended Learning Management to Develop Critical Thinking Skills Among Undergraduate Students",
      "org_slug": "education-faculty",
      "year": 2565,
      "abstract": "งานวิจัยนี้ออกแบบและทดลองใช้รูปแบบการจัดการเรียนรู้แบบผสมผสานระหว่างการเรียนในชั้นเรียนและออนไลน์ เพื่อพัฒนาทักษะการคิดวิเคราะห์ของนักศึกษาระดับปริญญาตรี ผลการวิจัยพบว่านักศึกษาที่เรียนด้วยรูปแบบผสมผสานมีคะแนนทักษะการคิดวิเคราะห์สูงกว่ากลุ่มที่เรียนแบบปกติอย่างมีนัยสำคัญ",
      "cover": "/covers/cover-05.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 110,
      "access": "read_only",
      "status": "published",
      "views": 1420,
      "downloads": 0,
      "published_at": "2022-08-30T00:00:00+07:00",
      "categories": ["education"],
      "keywords": ["การเรียนรู้แบบผสมผสาน", "ทักษะการคิดวิเคราะห์", "การจัดการเรียนการสอน"],
      "authors": [
        {"name": "ดร.สุพัตรา เรืองวิทย์", "org_slug": "education-faculty"},
        {"name": "นายอนุชา พงษ์ไพบูลย์", "org_slug": "education-faculty"}
      ]
    },
    {
      "slug": "social-2024-006",
      "title_th": "การเปลี่ยนแปลงพฤติกรรมการบริโภคสื่อของคนรุ่น Gen Z ในยุคดิจิทัล",
      "title_en": "Changing Media Consumption Behavior of Generation Z in the Digital Era",
      "org_slug": "social-faculty",
      "year": 2568,
      "abstract": "การวิจัยเชิงคุณภาพนี้ศึกษาการเปลี่ยนแปลงพฤติกรรมการบริโภคสื่อของกลุ่มคนรุ่น Gen Z ผ่านการสัมภาษณ์เชิงลึกและการสังเกตพฤติกรรมบนแพลตฟอร์มโซเชียลมีเดีย ผลการศึกษาชี้ให้เห็นแนวโน้มการบริโภคเนื้อหาแบบสั้นและปฏิสัมพันธ์แบบเรียลไทม์ที่เพิ่มขึ้นอย่างต่อเนื่อง",
      "cover": "/covers/cover-06.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 76,
      "access": "public",
      "status": "published",
      "views": 3210,
      "downloads": 720,
      "published_at": "2025-03-05T00:00:00+07:00",
      "categories": ["social"],
      "keywords": ["Generation Z", "พฤติกรรมผู้บริโภค", "สื่อดิจิทัล", "โซเชียลมีเดีย"],
      "authors": [
        {"name": "ผศ.ดร.ธีรภัทร มั่นคง", "org_slug": "social-faculty"}
      ]
    },
    {
      "slug": "agri-2024-007",
      "title_th": "การใช้โดรนเพื่อประเมินความสมบูรณ์ของแปลงนาข้าวด้วยภาพถ่ายมัลติสเปกตรัม",
      "title_en": "Using Drones to Assess Rice Field Health via Multispectral Imagery",
      "org_slug": "agriculture-faculty",
      "year": 2566,
      "abstract": "งานวิจัยนี้พัฒนากระบวนการใช้โดรนติดกล้องมัลติสเปกตรัมเพื่อประเมินดัชนีความสมบูรณ์ของพืช (NDVI) ในแปลงนาข้าว และเปรียบเทียบกับการสำรวจภาคสนามแบบดั้งเดิม ผลการศึกษาพบว่าวิธีการนี้สามารถลดระยะเวลาการสำรวจได้มากกว่าร้อยละ 70 และมีความแม่นยำใกล้เคียงกับวิธีดั้งเดิม",
      "cover": "/covers/cover-07.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 102,
      "access": "member_only",
      "status": "published",
      "views": 1560,
      "downloads": 310,
      "published_at": "2023-06-18T00:00:00+07:00",
      "categories": ["agriculture"],
      "keywords": ["โดรนเกษตร", "ภาพถ่ายมัลติสเปกตรัม", "นาข้าว", "เกษตรแม่นยำ"],
      "authors": [
        {"name": "ดร.วิภาวี ทองใบ", "org_slug": "agriculture-faculty"},
        {"name": "นายศักดิ์ดา บุญมาก", "org_slug": "agriculture-faculty"}
      ]
    },
    {
      "slug": "sci-2024-008",
      "title_th": "การสังเคราะห์วัสดุนาโนคาร์บอนจากชีวมวลเหลือทิ้งทางการเกษตรเพื่อการดูดซับโลหะหนัก",
      "title_en": "Synthesis of Carbon Nanomaterials from Agricultural Waste Biomass for Heavy Metal Adsorption",
      "org_slug": "science-faculty",
      "year": 2567,
      "abstract": "งานวิจัยนี้นำเสนอกระบวนการสังเคราะห์วัสดุนาโนคาร์บอนจากเปลือกข้าวและซังข้าวโพดซึ่งเป็นชีวมวลเหลือทิ้งทางการเกษตร เพื่อใช้เป็นวัสดุดูดซับโลหะหนักในน้ำเสีย ผลการทดลองพบว่าวัสดุที่พัฒนาขึ้นมีประสิทธิภาพการดูดซับตะกั่วและแคดเมียมสูงกว่าถ่านกัมมันต์เชิงพาณิชย์",
      "cover": "/covers/cover-08.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 140,
      "access": "public",
      "status": "published",
      "views": 2010,
      "downloads": 605,
      "published_at": "2024-09-12T00:00:00+07:00",
      "categories": ["science"],
      "keywords": ["วัสดุนาโนคาร์บอน", "ชีวมวล", "การดูดซับโลหะหนัก", "เคมีสิ่งแวดล้อม"],
      "authors": [
        {"name": "รศ.ดร.มนตรี ศรีวิไล", "org_slug": "science-faculty"}
      ]
    },
    {
      "slug": "eng-2024-009",
      "title_th": "การออกแบบระบบผลิตไฟฟ้าจากพลังงานแสงอาทิตย์แบบติดตามดวงอาทิตย์สองแกนต้นทุนต่ำ",
      "title_en": "Design of a Low-Cost Dual-Axis Solar Tracking Power Generation System",
      "org_slug": "engineering-faculty",
      "year": 2568,
      "abstract": "งานวิจัยนี้ออกแบบและสร้างต้นแบบระบบติดตามดวงอาทิตย์แบบสองแกนต้นทุนต่ำสำหรับแผงโซลาร์เซลล์ขนาดครัวเรือน โดยใช้เซนเซอร์แสงและไมโครคอนโทรลเลอร์ราคาประหยัด ผลการทดสอบพบว่าระบบสามารถเพิ่มประสิทธิภาพการผลิตไฟฟ้าได้เฉลี่ยร้อยละ 28 เมื่อเทียบกับแผงแบบติดตั้งคงที่",
      "cover": "/covers/cover-09.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 118,
      "access": "public",
      "status": "published",
      "views": 2870,
      "downloads": 690,
      "published_at": "2025-02-01T00:00:00+07:00",
      "categories": ["engineering"],
      "keywords": ["พลังงานแสงอาทิตย์", "ระบบติดตามดวงอาทิตย์", "พลังงานทดแทน"],
      "authors": [
        {"name": "ผศ.ดร.ประเสริฐ วงศ์สกุล", "org_slug": "engineering-faculty"}
      ]
    },
    {
      "slug": "it-2024-010",
      "title_th": "ระบบตรวจจับการโจมตีทางไซเบอร์ในเครือข่าย IoT ด้วยเทคนิคการเรียนรู้เชิงลึก",
      "title_en": "Cyberattack Detection System for IoT Networks Using Deep Learning Techniques",
      "org_slug": "it-faculty",
      "year": 2566,
      "abstract": "งานวิจัยนี้พัฒนาระบบตรวจจับการโจมตีทางไซเบอร์สำหรับเครือข่ายอุปกรณ์ IoT โดยใช้แบบจำลองโครงข่ายประสาทเทียมเชิงลึก (Deep Learning) ในการวิเคราะห์รูปแบบการจราจรเครือข่ายที่ผิดปกติ ผลการทดสอบกับชุดข้อมูลมาตรฐานแสดงความแม่นยำในการตรวจจับสูงถึงร้อยละ 97.8",
      "cover": "/covers/cover-10.svg",
      "pdf": "/mock-pdfs/sample.pdf",
      "pages": 134,
      "access": "staff_only",
      "status": "published",
      "views": 1980,
      "downloads": 275,
      "published_at": "2023-12-22T00:00:00+07:00",
      "categories": ["it"],
      "keywords": ["ความมั่นคงปลอดภัยไซเบอร์", "IoT", "การเรียนรู้เชิงลึก", "การตรวจจับการบุกรุก"],
      "authors": [
        {"name": "ดร.ชนากานต์ ทิพย์วงศ์", "org_slug": "it-faculty"},
        {"name": "นายภาณุพงศ์ แสงทอง", "org_slug": "it-faculty"}
      ]
    }
  ]
  $seed$::jsonb;

  v_item jsonb;
  v_author jsonb;
  v_research_id uuid;
  v_org_id uuid;
  v_author_org_id uuid;
  v_category_id uuid;
  v_keyword_id uuid;
  v_author_id uuid;
  v_cat_slug text;
  v_kw text;
  v_order int;
begin
  for v_item in select * from jsonb_array_elements(v_items) loop
    select id into v_org_id from public.organizations where slug = v_item ->> 'org_slug';

    insert into public.research_items (
      slug, title_th, title_en, organization_id, year, abstract,
      cover_image, pdf_file, page_count, access_level, status,
      views, downloads, published_at
    ) values (
      v_item ->> 'slug',
      v_item ->> 'title_th',
      v_item ->> 'title_en',
      v_org_id,
      (v_item ->> 'year')::int,
      v_item ->> 'abstract',
      v_item ->> 'cover',
      v_item ->> 'pdf',
      (v_item ->> 'pages')::int,
      v_item ->> 'access',
      v_item ->> 'status',
      (v_item ->> 'views')::bigint,
      (v_item ->> 'downloads')::bigint,
      (v_item ->> 'published_at')::timestamptz
    )
    on conflict (slug) do nothing
    returning id into v_research_id;

    if v_research_id is null then
      -- มีอยู่แล้ว (รันซ้ำ) ข้ามการสร้างความสัมพันธ์ซ้ำของรายการนี้
      continue;
    end if;

    for v_cat_slug in select jsonb_array_elements_text(v_item -> 'categories') loop
      select id into v_category_id from public.categories where slug = v_cat_slug;
      if v_category_id is not null then
        insert into public.research_categories (research_id, category_id)
        values (v_research_id, v_category_id)
        on conflict do nothing;
      end if;
    end loop;

    for v_kw in select jsonb_array_elements_text(v_item -> 'keywords') loop
      insert into public.keywords (keyword) values (v_kw)
      on conflict (keyword) do update set keyword = excluded.keyword
      returning id into v_keyword_id;

      insert into public.research_keywords (research_id, keyword_id)
      values (v_research_id, v_keyword_id)
      on conflict do nothing;
    end loop;

    v_order := 1;
    for v_author in select * from jsonb_array_elements(v_item -> 'authors') loop
      select id into v_author_org_id
      from public.organizations
      where slug = (v_author ->> 'org_slug');

      insert into public.authors (name, organization_id)
      values (v_author ->> 'name', v_author_org_id)
      returning id into v_author_id;

      insert into public.research_authors (research_id, author_id, author_order)
      values (v_research_id, v_author_id, v_order)
      on conflict do nothing;

      v_order := v_order + 1;
    end loop;
  end loop;
end;
$$;

-- ============================================================================
-- ข้อความตัวอย่างสำหรับทดสอบระบบค้นหาเนื้อหาภายใน PDF (research_document_texts)
-- — จำลองผลลัพธ์ที่ lib/pdf/process-extraction.server.ts จะสร้างจริงตอน
-- อัปโหลดไฟล์จริง (สถานะ completed) สำหรับ 3 รายการที่มีระดับสิทธิ์ต่างกัน
-- (public 2 รายการ, member_only 1 รายการ) เพื่อทดสอบว่าการมองเห็น snippet
-- เคารพสิทธิ์ access_level เดียวกับตัวเอกสารจริง — ไม่ใช่ข้อความจากไฟล์ PDF
-- จริง (pdf_file ของข้อมูลตัวอย่างชี้ไปที่ /mock-pdfs/sample.pdf ซึ่งเป็น
-- placeholder เท่านั้น) จึงต้อง insert ตรงมาที่นี่แทนการรัน extraction จริง
-- ============================================================================
do $$
declare
  v_texts jsonb := $texts$
  [
    {
      "slug": "eng-2024-001",
      "text": "บทที่ 1 บทนำ งานวิจัยนี้นำเสนอการออกแบบและพัฒนาระบบตรวจสอบสุขภาพโครงสร้างสะพาน (Bridge Structural Health Monitoring) แบบเรียลไทม์ โดยใช้เครือข่ายเซนเซอร์ไร้สาย (Wireless Sensor Network) ติดตั้งตามจุดวิกฤตของโครงสร้าง ร่วมกับแบบจำลองการเรียนรู้ของเครื่อง (Machine Learning) เพื่อวิเคราะห์แนวโน้มความเสียหาย บทที่ 2 ทบทวนวรรณกรรม เทคโนโลยี IoT (Internet of Things) ถูกนำมาประยุกต์ใช้อย่างแพร่หลายในงานวิศวกรรมโครงสร้างช่วงทศวรรษที่ผ่านมา บทที่ 3 วิธีดำเนินการวิจัย ระบบประกอบด้วยเซนเซอร์วัดความเครียด (Strain Gauge) เซนเซอร์วัดความสั่นสะเทือน และโหนดสื่อสารไร้สายมาตรฐาน LoRaWAN บทที่ 4 ผลการทดลอง ผลการทดลองแสดงให้เห็นว่าระบบสามารถตรวจจับความผิดปกติของโครงสร้างได้อย่างแม่นยำถึงร้อยละ 94.2 และช่วยลดค่าใช้จ่ายในการบำรุงรักษาเชิงป้องกันได้อย่างมีนัยสำคัญเมื่อเทียบกับวิธีการตรวจสอบแบบดั้งเดิม"
    },
    {
      "slug": "it-2024-002",
      "text": "Chapter 1 Introduction This study evaluates the performance of Large Language Models (LLM) in summarizing complex Thai government documents. โมเดลภาษาขนาดใหญ่ (Large Language Model) ได้รับความสนใจอย่างมากในช่วงไม่กี่ปีที่ผ่านมา โดยเฉพาะความสามารถด้านการประมวลผลภาษาธรรมชาติ (Natural Language Processing) Chapter 2 Related Work Previous research on Thai NLP has been limited by the lack of large annotated datasets. บทที่ 3 วิธีการวิจัย เราทำการปรับแต่งโมเดล (Fine-tuning) ด้วยชุดข้อมูลเอกสารราชการภาษาไทยจำนวน 12,000 ฉบับ ผลการวิจัยพบว่าการปรับแต่งโมเดลด้วยชุดข้อมูลเฉพาะทางช่วยเพิ่มความแม่นยำของบทสรุปได้มากกว่าร้อยละ 20 เมื่อเทียบกับโมเดลพื้นฐาน (Baseline Model) โดยวัดผลด้วยตัวชี้วัด ROUGE-L Score"
    },
    {
      "slug": "social-2024-006",
      "text": "บทนำ การวิจัยเชิงคุณภาพนี้ศึกษาการเปลี่ยนแปลงพฤติกรรมการบริโภคสื่อของกลุ่มคนรุ่น Generation Z ในประเทศไทย ผ่านการสัมภาษณ์เชิงลึก (In-depth Interview) จำนวน 30 คน และการสังเกตพฤติกรรมบนแพลตฟอร์มโซเชียลมีเดีย (Social Media Platform) ได้แก่ TikTok, Instagram และ YouTube Shorts ผลการศึกษาชี้ให้เห็นแนวโน้มการบริโภคเนื้อหาแบบสั้น (Short-form Content) และปฏิสัมพันธ์แบบเรียลไทม์ที่เพิ่มขึ้นอย่างต่อเนื่อง กลุ่มตัวอย่าง Generation Z ใช้เวลาเฉลี่ยบนโซเชียลมีเดียมากกว่า 4.5 ชั่วโมงต่อวัน และให้ความสำคัญกับเนื้อหาที่สร้างโดยผู้ใช้งานทั่วไป (User-generated Content) มากกว่าเนื้อหาจากสื่อกระแสหลักแบบดั้งเดิม"
    }
  ]
  $texts$::jsonb;

  v_text jsonb;
  v_research_id uuid;
  v_raw text;
  v_normalized text;
begin
  for v_text in select * from jsonb_array_elements(v_texts) loop
    select id into v_research_id
    from public.research_items
    where slug = v_text ->> 'slug';

    if v_research_id is null then
      continue;
    end if;

    v_raw := v_text ->> 'text';
    v_normalized := lower(regexp_replace(v_raw, '\s+', ' ', 'g'));

    insert into public.research_document_texts (
      research_item_id, extracted_text, extracted_text_normalized,
      extraction_status, extraction_error_message, extracted_at,
      source_file_path, source_file_hash
    )
    select
      v_research_id, v_raw, v_normalized,
      'completed', null, now(),
      ri.pdf_file, encode(sha256(v_raw::bytea), 'hex')
    from public.research_items ri
    where ri.id = v_research_id
    on conflict (research_item_id) do update set
      extracted_text = excluded.extracted_text,
      extracted_text_normalized = excluded.extracted_text_normalized,
      extraction_status = excluded.extraction_status,
      extraction_error_message = excluded.extraction_error_message,
      extracted_at = excluded.extracted_at,
      source_file_path = excluded.source_file_path,
      source_file_hash = excluded.source_file_hash;
  end loop;
end;
$$;

-- ============================================================================
-- LOCAL DEV ONLY — NEVER run on production (triggers/notifications on prod are not reproduced locally)
-- ============================================================================

-- ============================================================================
-- หนังสือ open-license 6 เล่มสำหรับทดสอบการแสดงข้อมูลบรรณานุกรม
-- (license / license_url / source_url / publisher / language)
--
-- metadata_only + pdf_file = NULL โดยตั้งใจ: ไม่มีไฟล์ PDF ใน Storage — ห้ามใช้
-- public/read_only เพราะปุ่มอ่าน/ดาวน์โหลดจะชี้ไปยังไฟล์ที่ไม่มีอยู่ (ดู
-- lib/storage/signed-url.server.ts) status = published เพื่อให้ guest เห็นแถว
-- ตาม RLS (research_items_select) ฟิลด์ที่แคตตาล็อกไม่มี (page_count, organization,
-- title_lo) คงเป็นค่าเริ่มต้น/NULL ไม่เดา
--
-- idempotent: ON CONFLICT (slug) DO NOTHING — รันซ้ำแล้วไม่เพิ่มแถว/ความสัมพันธ์
-- ============================================================================
do $$
declare
  v_items jsonb := $oa$
  [
    {
      "slug": "oa-mouhot-travels-indochina-vol1",
      "title_th": "การเดินทางในดินแดนตอนกลางของอินโดจีน (สยาม) กัมพูชา และลาว เล่ม 1",
      "title_en": "Travels in the Central Parts of Indo-China (Siam), Cambodia, and Laos, Vol. 1",
      "year": 2407,
      "abstract": "First volume of the French naturalist Henri Mouhot's account of his 1858-1860 journeys through Siam, Cambodia and Laos, compiled after his death in Laos in 1861. Covers his arrival in Bangkok and early expeditions, with engravings based on his own sketches. A primary historical source on the region in the mid-19th century.",
      "publisher": "John Murray, London",
      "language": "en",
      "license": "Public Domain",
      "license_url": null,
      "source_url": "https://www.gutenberg.org/ebooks/46559",
      "isbn": null,
      "doi": null,
      "category": "history",
      "keywords": [
        "Laos",
        "Mekong",
        "Indochina",
        "19th century",
        "travel narrative",
        "natural history"
      ],
      "authors": [
        {
          "name": "Henri Mouhot",
          "role": "principal_investigator"
        }
      ]
    },
    {
      "slug": "oa-mouhot-travels-indochina-vol2",
      "title_th": "การเดินทางในดินแดนตอนกลางของอินโดจีน (สยาม) กัมพูชา และลาว เล่ม 2",
      "title_en": "Travels in the Central Parts of Indo-China (Siam), Cambodia, and Laos, Vol. 2",
      "year": 2407,
      "abstract": "Second volume of Mouhot's travels, covering the Angkor ruins, the Laotian settlements he encountered, and his final journey up the Mekong into Laos. Includes notes compiled by his family and illustrations from his sketches.",
      "publisher": "John Murray, London",
      "language": "en",
      "license": "Public Domain",
      "license_url": null,
      "source_url": "https://www.gutenberg.org/ebooks/46560",
      "isbn": null,
      "doi": null,
      "category": "history",
      "keywords": [
        "Laos",
        "Angkor",
        "Mekong",
        "Indochina",
        "travel narrative"
      ],
      "authors": [
        {
          "name": "Henri Mouhot",
          "role": "principal_investigator"
        }
      ]
    },
    {
      "slug": "oa-white-gold-rice-lower-mekong",
      "title_th": "ทองคำขาว: การทำนาข้าวเชิงพาณิชย์ในลุ่มน้ำโขงตอนล่าง",
      "title_en": "White Gold: The Commercialisation of Rice Farming in the Lower Mekong Basin",
      "year": 2563,
      "abstract": "Edited research volume examining how smallholder rice farming in the Lower Mekong Basin shifted from subsistence to commercial production. Compares Northeast Thailand, Central Laos, Southeastern Cambodia and the Mekong Delta, covering farm trajectories, value chains and government rice policy.",
      "publisher": "Palgrave Macmillan (Springer Nature)",
      "language": "en",
      "license": "CC BY 4.0",
      "license_url": "https://creativecommons.org/licenses/by/4.0/",
      "source_url": "https://library.oapen.org/handle/20.500.12657/23169",
      "isbn": "978-981-15-0998-8",
      "doi": "10.1007/978-981-15-0998-8",
      "category": "agriculture",
      "keywords": [
        "rice",
        "agriculture",
        "Central Laos",
        "Mekong",
        "value chains",
        "agricultural policy"
      ],
      "authors": [
        {
          "name": "Rob Cramb",
          "role": "principal_investigator"
        }
      ]
    },
    {
      "slug": "oa-lao-economic-monitor-2025-05",
      "title_th": "รายงานติดตามเศรษฐกิจ สปป.ลาว พฤษภาคม 2025: การรับมือความเสี่ยง",
      "title_en": "Lao PDR Economic Monitor, May 2025: Weathering Risks",
      "year": 2568,
      "abstract": "Biannual World Bank report on the Lao economy. Reviews 2024 growth led by services, tourism and transport, easing but still high inflation, and fiscal pressure from peak debt repayments in 2025, with a thematic section on access to finance.",
      "publisher": "World Bank, Washington DC",
      "language": "en",
      "license": "CC BY-NC 3.0 IGO",
      "license_url": "https://creativecommons.org/licenses/by-nc/3.0/igo/",
      "source_url": "http://hdl.handle.net/10986/43340",
      "isbn": null,
      "doi": null,
      "category": "business",
      "keywords": [
        "Lao PDR",
        "macroeconomics",
        "inflation",
        "public debt",
        "kip",
        "fiscal policy"
      ],
      "authors": [
        {
          "name": "World Bank",
          "role": "principal_investigator"
        }
      ]
    },
    {
      "slug": "oa-social-science-research-methods",
      "title_th": "การวิจัยทางสังคมศาสตร์: หลักการ วิธีการ และการปฏิบัติ (พิมพ์ครั้งที่ 2)",
      "title_en": "Social Science Research: Principles, Methods, and Practices (2nd ed.)",
      "year": 2555,
      "abstract": "Open textbook introducing graduate students to the scientific research process in the social sciences, business, education and public health: theory building, measurement, sampling, surveys, experiments, interpretive research, data analysis and research ethics.",
      "publisher": "University of South Florida (Scholar Commons)",
      "language": "en",
      "license": "CC BY-NC-SA 3.0",
      "license_url": "https://creativecommons.org/licenses/by-nc-sa/3.0/",
      "source_url": "https://digitalcommons.usf.edu/oa_textbooks/3/",
      "isbn": "978-1475146127",
      "doi": null,
      "category": "social",
      "keywords": [
        "research methods",
        "social science",
        "sampling",
        "survey research",
        "research ethics"
      ],
      "authors": [
        {
          "name": "Anol Bhattacherjee",
          "role": "principal_investigator"
        }
      ]
    },
    {
      "slug": "oa-openstax-introductory-statistics-2e",
      "title_th": "สถิติเบื้องต้น ฉบับที่ 2 (Introductory Statistics 2e)",
      "title_en": "Introductory Statistics 2e",
      "year": 2566,
      "abstract": "One-semester introductory statistics textbook with applications across business, health, sciences and social sciences. Covers descriptive statistics, probability, distributions, hypothesis testing and regression, with worked examples, exercises and labs.",
      "publisher": "OpenStax, Rice University",
      "language": "en",
      "license": "CC BY 4.0",
      "license_url": "https://creativecommons.org/licenses/by/4.0/",
      "source_url": "https://openstax.org/details/books/introductory-statistics-2e",
      "isbn": "978-1-961584-32-7",
      "doi": null,
      "category": "science",
      "keywords": [
        "statistics",
        "probability",
        "hypothesis testing",
        "data analysis",
        "textbook"
      ],
      "authors": [
        {
          "name": "Barbara Illowsky",
          "role": "principal_investigator"
        },
        {
          "name": "Susan Dean",
          "role": "co_investigator"
        }
      ]
    }
  ]
  $oa$::jsonb;

  v_item jsonb;
  v_author jsonb;
  v_research_id uuid;
  v_category_id uuid;
  v_keyword_id uuid;
  v_author_id uuid;
  v_kw text;
  v_order int;
begin
  for v_item in select * from jsonb_array_elements(v_items) loop
    insert into public.research_items (
      slug, title_th, title_en, year, abstract,
      publisher, language, license, license_url, source_url, isbn, doi,
      access_level, status
    ) values (
      v_item ->> 'slug',
      v_item ->> 'title_th',
      v_item ->> 'title_en',
      (v_item ->> 'year')::int,
      v_item ->> 'abstract',
      v_item ->> 'publisher',
      v_item ->> 'language',
      v_item ->> 'license',
      v_item ->> 'license_url',
      v_item ->> 'source_url',
      v_item ->> 'isbn',
      v_item ->> 'doi',
      'metadata_only',
      'published'
    )
    on conflict (slug) do nothing
    returning id into v_research_id;

    if v_research_id is null then
      -- มีอยู่แล้ว (รันซ้ำ) ข้ามการสร้างความสัมพันธ์ซ้ำของรายการนี้
      continue;
    end if;

    select id into v_category_id from public.categories where slug = v_item ->> 'category';
    if v_category_id is not null then
      insert into public.research_categories (research_id, category_id)
      values (v_research_id, v_category_id)
      on conflict do nothing;
    end if;

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
      -- ผู้แต่งคนเดียวกัน (เช่น Mouhot เล่ม 1/2) ใช้แถว authors เดียวกัน
      select id into v_author_id
      from public.authors
      where name = v_author ->> 'name' and organization_id is null and profile_id is null
      order by created_at
      limit 1;

      if v_author_id is null then
        insert into public.authors (name) values (v_author ->> 'name')
        returning id into v_author_id;
      end if;

      insert into public.research_authors (research_id, author_id, author_order, author_role)
      values (v_research_id, v_author_id, v_order, v_author ->> 'role')
      on conflict do nothing;

      v_order := v_order + 1;
    end loop;
  end loop;
end;
$$;
-- local/dev only — license metadata from file_prompt/open-books-catalog.json; World Bank license requires librarian confirmation before production

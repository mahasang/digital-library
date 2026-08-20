# Feature: Public Researcher Profile Page — `/[locale]/authors/[id]`

## Context

- Next.js 15 App Router + TypeScript + Supabase + Tailwind CSS
- next-intl v4, locales: `lo` (default), `th`, `en`, `vi`, localePrefix: `always`
- ตาราง `authors` มีข้อมูลพร้อมแล้ว:
  - `id` (uuid), `name` (ชื่อภาษาไทย), `display_name_en`, `title_prefix_th/en`
  - `orcid`, `orcid_verified_at`, `orcid_oauth_verified_at`, `orcid_api_public_name`
  - `biography`, `is_active`, `merged_into_author_id`
  - `organization_id` → join กับ `organizations` ได้
- ตาราง `research_items` มี `status`, `access_level`, `published_at`
- ตาราง `research_authors` เชื่อม `research_items` ↔ `authors` (many-to-many)
- RLS มีอยู่แล้ว — ใช้ `createPublicClient()` สำหรับ public data
- ไม่มี migration ใหม่ — ใช้ schema ที่มีอยู่ทั้งหมด
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope — ทำเฉพาะสิ่งต่อไปนี้

1. Data layer: `lib/data/authors-public.server.ts`
2. Route: `app/[locale]/authors/[id]/page.tsx` (Server Component, SSG)
3. Components: `components/authors/` (AuthorProfileCard, AuthorResearchList)
4. เพิ่ม link จาก `ResearchCard` และหน้า research detail ไปยัง author profile
5. เพิ่ม translation keys ใน `messages/*.json` ทุก locale
6. รัน lint + tsc + test + build

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS policies, middleware auth, signed URL, MFA
- ห้ามแตะ `app/api/`, `app/[locale]/dashboard/`, `app/[locale]/superadmin/`
- ห้ามแตะ Supabase service role หรือ admin functions
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

```bash
# ดูโครงสร้าง authors ที่มีอยู่
ls app/\[locale\]/
cat lib/data/authors-admin.server.ts | head -60

# ดู ResearchCard component
cat components/research/ResearchCard.tsx | head -80

# ดู research detail page
cat "app/[locale]/research/[id]/page.tsx" | head -60

# ดู messages namespace ที่มีอยู่
cat messages/lo.json | python -c "
import json,sys
d=json.load(sys.stdin)
print(list(d.keys()))
"

# ดู createPublicClient
cat lib/supabase/public.ts 2>/dev/null || grep -rn "createPublicClient\|PublicClient" lib/supabase/ | head -10
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — Data Layer

สร้าง `lib/data/authors-public.server.ts`:

```typescript
import { createPublicClient } from "@/lib/supabase/public";
import { cache } from "react";

export type PublicAuthorProfile = {
  id: string;
  name: string;
  display_name_en: string | null;
  title_prefix_th: string | null;
  title_prefix_en: string | null;
  biography: string | null;
  orcid: string | null;
  orcid_verified_at: string | null;
  orcid_oauth_verified_at: string | null;
  organization: { id: string; name: string } | null;
};

export type PublicAuthorResearch = {
  id: string;
  title_th: string;
  title_en: string | null;
  published_at: string | null;
  access_level: string;
  cover_url: string | null;
  categories: { id: string; name: string }[];
};

// ดึงข้อมูล author โดย id — เฉพาะที่ is_active = true และไม่มี merged_into
export const getPublicAuthorProfile = cache(async (
  id: string
): Promise<PublicAuthorProfile | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("authors")
    .select(`
      id, name, display_name_en,
      title_prefix_th, title_prefix_en,
      biography, orcid, orcid_verified_at,
      orcid_oauth_verified_at,
      organizations ( id, name )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .is("merged_into_author_id", null)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    organization: data.organizations ?? null,
  } as PublicAuthorProfile;
});

// ดึงงานวิจัยที่ published และ public ของ author
// ไม่รวม member_only / staff_only (ปลอดภัยสำหรับ guest)
export const getPublicAuthorResearch = cache(async (
  authorId: string
): Promise<PublicAuthorResearch[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("research_authors")
    .select(`
      research_items!inner (
        id, title_th, title_en, published_at,
        access_level, cover_url,
        research_categories (
          categories ( id, name )
        )
      )
    `)
    .eq("author_id", authorId)
    .eq("research_items.status", "published")
    .in("research_items.access_level", ["public", "read_only", "metadata_only"])
    .order("research_items(published_at)", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data
    .map((row: any) => ({
      ...row.research_items,
      categories: row.research_items.research_categories
        ?.map((rc: any) => rc.categories)
        .filter(Boolean) ?? [],
    }))
    .filter(Boolean);
});
```

**หมายเหตุ:** ถ้า Supabase query syntax ของ nested relation ไม่ตรงกับ version ที่ใช้
ให้ตรวจ `lib/data/authors-admin.server.ts` หรือไฟล์อื่นที่ query `authors` จริงแล้วใช้ pattern เดียวกัน

---

## Step 3 — Route Page

สร้าง `app/[locale]/authors/[id]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublicAuthorProfile, getPublicAuthorResearch } from "@/lib/data/authors-public.server";
import { AuthorProfileCard } from "@/components/authors/AuthorProfileCard";
import { AuthorResearchList } from "@/components/authors/AuthorResearchList";
import Container from "@/components/ui/Container";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const author = await getPublicAuthorProfile(id);
  if (!author) return {};
  return {
    title: author.display_name_en
      ? `${author.name} (${author.display_name_en})`
      : author.name,
    description: author.biography?.slice(0, 160) ?? undefined,
  };
}

export default async function AuthorProfilePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("authors");

  const [author, research] = await Promise.all([
    getPublicAuthorProfile(id),
    getPublicAuthorResearch(id),
  ]);

  if (!author) notFound();

  return (
    <Container className="py-8 max-w-4xl">
      <AuthorProfileCard author={author} t={t} />
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">{t("publishedResearch")}</h2>
        <AuthorResearchList research={research} t={t} />
      </div>
    </Container>
  );
}
```

---

## Step 4 — Components

### `components/authors/AuthorProfileCard.tsx`

```typescript
import { BookOpen, ExternalLink, Building2, BadgeCheck } from "lucide-react";
import type { PublicAuthorProfile } from "@/lib/data/authors-public.server";

type Props = {
  author: PublicAuthorProfile;
  t: (key: string) => string;
};

export function AuthorProfileCard({ author, t }: Props) {
  const isOrcidVerified = !!(author.orcid_verified_at || author.orcid_oauth_verified_at);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      {/* ชื่อและตำแหน่ง */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {author.title_prefix_th ? `${author.title_prefix_th} ` : ""}
            {author.name}
          </h1>
          {author.display_name_en && (
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              {author.title_prefix_en ? `${author.title_prefix_en} ` : ""}
              {author.display_name_en}
            </p>
          )}
          {/* หน่วยงาน */}
          {author.organization && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{author.organization.name}</span>
            </div>
          )}
          {/* ORCID */}
          {author.orcid && (
            <div className="flex items-center gap-1.5 mt-1.5 text-sm">
              <a
                href={`https://orcid.org/${author.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-700 dark:text-green-400 hover:underline"
              >
                <span className="font-mono">{author.orcid}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {isOrcidVerified && (
                <span className="flex items-center gap-0.5 text-green-700 dark:text-green-400 text-xs">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("orcidVerified")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* ประวัติย่อ */}
      {author.biography && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {author.biography}
          </p>
        </div>
      )}
    </div>
  );
}
```

### `components/authors/AuthorResearchList.tsx`

```typescript
import Link from "next/link";
import { useLocale } from "next-intl";
import type { PublicAuthorResearch } from "@/lib/data/authors-public.server";

// นี่เป็น Server Component — ไม่ใช้ useLocale
// รับ locale เป็น prop แทน
type Props = {
  research: PublicAuthorResearch[];
  t: (key: string) => string;
  locale: string;
};

export function AuthorResearchList({ research, t, locale }: Props) {
  if (research.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {t("noPublishedResearch")}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {research.map((item) => (
        <li key={item.id}>
          <Link
            href={`/${locale}/research/${item.id}`}
            className="block rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <p className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
              {item.title_th}
            </p>
            {item.title_en && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                {item.title_en}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {item.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.id}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
                >
                  {cat.name}
                </span>
              ))}
              {item.published_at && (
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(item.published_at).getFullYear()}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**หมายเหตุ:** `AuthorResearchList` เป็น Server Component ไม่ใช้ `useLocale`
ให้รับ `locale` เป็น prop จาก page แทน แก้ type ตามนั้น

---

## Step 5 — เพิ่ม link ไปยัง Author Profile

### จาก ResearchCard

เปิด `components/research/ResearchCard.tsx` แล้วตรวจว่ามีการแสดงชื่อผู้วิจัยไหม:

```bash
grep -n "author\|researcher\|ผู้วิจัย" components/research/ResearchCard.tsx | head -20
```

ถ้ามีชื่อผู้วิจัยแสดงอยู่ (เป็น string หรือ array) ให้เพิ่ม link ไปที่ `/[locale]/authors/[author.id]`:

```tsx
// ถ้ามี author.id
<Link href={`/${locale}/authors/${author.id}`} className="hover:underline text-accent-ink">
  {author.name}
</Link>
```

ถ้าชื่อผู้วิจัยใน ResearchCard เป็นแค่ string (ไม่มี id) **ไม่ต้องแก้** — บันทึกไว้ว่าต้องทำในรอบถัดไป

### จาก Research Detail Page

เปิด `app/[locale]/research/[id]/page.tsx` แล้วตรวจส่วนที่แสดงผู้วิจัย:

```bash
grep -n "author\|researcher\|ผู้วิจัย" "app/[locale]/research/[id]/page.tsx" | head -20
```

เพิ่ม link ไปที่ `/[locale]/authors/[author.id]` ในส่วนที่แสดงชื่อผู้วิจัย

---

## Step 6 — เพิ่ม Translation Keys

เพิ่ม namespace `authors` ใน **ทุก locale** (`lo`, `th`, `en`, `vi`):

**`messages/lo.json`** (ลาว):
```json
"authors": {
  "profile": "ໂປຣໄຟລ໌ນັກວິໄຈ",
  "publishedResearch": "ງານວິໄຈທີ່ເຜີຍແຜ່",
  "noPublishedResearch": "ຍັງບໍ່ມີງານວິໄຈທີ່ເຜີຍແຜ່",
  "orcidVerified": "ຢືນຢັນແລ້ວ",
  "organization": "ໜ່ວຍງານ",
  "viewProfile": "ເບິ່ງໂປຣໄຟລ໌"
}
```

**`messages/th.json`** (ไทย):
```json
"authors": {
  "profile": "โปรไฟล์นักวิจัย",
  "publishedResearch": "งานวิจัยที่เผยแพร่",
  "noPublishedResearch": "ยังไม่มีงานวิจัยที่เผยแพร่",
  "orcidVerified": "ยืนยันแล้ว",
  "organization": "หน่วยงาน",
  "viewProfile": "ดูโปรไฟล์"
}
```

**`messages/en.json`** (อังกฤษ):
```json
"authors": {
  "profile": "Researcher Profile",
  "publishedResearch": "Published Research",
  "noPublishedResearch": "No published research yet",
  "orcidVerified": "Verified",
  "organization": "Organization",
  "viewProfile": "View Profile"
}
```

**`messages/vi.json`** (เวียดนาม):
```json
"authors": {
  "profile": "Hồ sơ nhà nghiên cứu",
  "publishedResearch": "Nghiên cứu đã xuất bản",
  "noPublishedResearch": "Chưa có nghiên cứu nào được xuất bản",
  "orcidVerified": "Đã xác minh",
  "organization": "Tổ chức",
  "viewProfile": "Xem hồ sơ"
}
```

---

## Step 7 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

ถ้า build ผ่าน ตรวจ HTTP:
```bash
npm run start &
sleep 5
# ใช้ UUID ของ author จริงในฐานข้อมูล
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/lo/authors/[AUTHOR_UUID]
# ต้องได้ 200 หรือ 404 (ถ้าไม่มี author นั้น)
```

หยุด server:
```powershell
Stop-Process -Name "node" -Force
```

---

## รายงานผลที่ต้องการ

1. ผล `cat lib/data/authors-admin.server.ts | head -60` — เพื่อยืนยัน query pattern
2. ไฟล์ที่สร้างใหม่และไฟล์ที่แก้ไข
3. ผล tsc / lint / test / build
4. ปัญหาที่พบ + วิธีแก้
5. UUID ของ author ตัวอย่างที่ทดสอบได้ (ถ้ามีในฐานข้อมูล)

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| Supabase nested join syntax ไม่ตรง | ตรวจ `authors-admin.server.ts` ก่อน ใช้ pattern เดียวกัน |
| `useLocale` ใน Server Component | ใช้ `locale` จาก `params` แทนเสมอ |
| `getTranslations` ใน Client Component | แยก Server/Client component ให้ชัด |
| Author ที่ถูก merge (`merged_into_author_id IS NOT NULL`) แสดงผล | กรอง `.is("merged_into_author_id", null)` ใน query |
| งานวิจัย member_only/staff_only รั่วไหล | กรอง `.in("access_level", ["public","read_only","metadata_only"])` |
| URL ชน `/[locale]/authors/` กับ dashboard authors | dashboard อยู่ที่ `/dashboard/authors/` ไม่ชนกัน |

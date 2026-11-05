# ชั้นหนังสือ 3D บน Hero หน้าแรก Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนชั้น 3 เล่มบน hero เป็นชั้น 3D ที่แสดงงานวิจัยจริง 16 เล่ม เลื่อนดูและเปิดดูรายเล่มได้ โดยมีรายการลิงก์จริงเป็น fallback

**Architecture:** เซิร์ฟเวอร์เรนเดอร์รายการลิงก์เสมอ แล้ว client โหลด Three.js แบบ dynamic มาทับเมื่ออุปกรณ์พร้อม ตรรกะล้วนอยู่ใน `shelfMath.ts` ส่วน `shelfScene.ts` ซ่อน Three.js ทั้งหมดไว้หลัง handle เล็กๆ ที่ React เรียกใช้

**Tech Stack:** Next.js 15, React 19, next-intl, Tailwind, three, Vitest, Playwright, axe

**Spec:** `docs/superpowers/specs/2026-11-04-home-3d-shelf-design.md`

## Global Constraints

- ทำงานบนสาขา `feat/home-3d-shelf` และ `git add` ระบุไฟล์ทีละไฟล์เท่านั้น ห้าม `git add -A` เพราะ working tree มีไฟล์ค้างที่ไม่เกี่ยวข้อง
- ไฟล์ใน repo เก็บเป็น LF แต่ `lib/data/{mappers,queries,types}.ts` และ `lib/data/research.homepage.test.ts` ใน working tree เป็น CRLF (ต่างกันแค่ EOL) ต้องแปลงเป็น LF ก่อนแก้ แล้วตรวจ `git diff --stat` ว่าเห็นเฉพาะบรรทัดที่แก้จริง
- `three` import ได้เฉพาะ `shelfScene.ts`, `bookGeometry.ts`, `bookTextures.ts` และโหลดผ่าน dynamic import เท่านั้น
- `SHELF_SIZE = 16`, บทคัดย่อไม่เกิน 280 ตัวอักษร, ลากเกิน 6px ไม่นับเป็นคลิก, โหลดปกหน้า ±3 เล่ม
- texture: สัน 128×1024, ปก 512×720, เล่มที่เปิดดู 1024×1440, โหลดปกจริงผ่าน `/_next/image`
- แถบชั้นสูง `clamp(280px, 38vh, 420px)` และ 260px เมื่อจอต่ำกว่า 640px
- `devicePixelRatio` สูงสุด 2 บนเดสก์ท็อป 1.5 บนมือถือ
- เพิ่ม JS ใน bundle แรกของหน้าแรกไม่เกิน 10 KB gzip
- ห้ามใช้ชื่อเล่ม ลาย ข้อความ หรือเลย์เอาต์ของ The Complete Shelf
- Vitest เก็บเฉพาะ `**/*.test.ts` environment เป็น node เทสต์ React จึงอยู่ใน Playwright

## Review Focus

1. ชื่อไทย/ลาวที่ต้องตัดบนสัน: ต้องไม่ตัดกลางกลุ่มอักษร จนสระหรือวรรณยุกต์หลุด (เทสต์ใน Task 2)
2. หนังสือน้อย เช่น 2 เล่ม: ชั้นไม่ควรเลื่อนเกินขอบ และปุ่มก่อนหน้า/ถัดไปต้อง disabled ที่ปลาย (Task 2, Task 6)
3. URL ปกเสียหรือ 404: เล่มนั้นใช้ปกเรียงพิมพ์ ส่วนเล่มอื่นทำงานต่อ (Task 6)
4. ออกจากหน้าแรกระหว่าง chunk 3D ยังโหลด: ต้องไม่สร้าง scene ค้างหลัง unmount (Task 4)
5. หมุนจอหรือปรับขนาดหน้าต่างขณะเปิดดูเล่ม: canvas ต้องปรับตาม และปิดแล้วชั้นกลับมาขนาดถูกต้อง (Task 5, Task 6)

---

### Task 1: ข้อมูลของชั้น

**Files:**
- Create: `components/home/shelf/types.ts`, `components/home/shelf/toShelfBook.ts`
- Modify: `lib/data/queries.ts`, `lib/data/types.ts`, `lib/data/mappers.ts`, `lib/data/research.server.ts`
- Test: `components/home/shelf/toShelfBook.test.ts`, `lib/data/research.homepage.test.ts`

**Interfaces:**
- Produces: `ShelfBook` ตาม spec, `SHELF_SIZE`, `getShelfResearch(limit: number): Promise<ResearchItem[]>`, `toShelfBook(item: ResearchItem, categories: Category[], locale: string): ShelfBook`, `truncateAbstract(text: string, max = 280): string`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**

ใน `toShelfBook.test.ts` เทสต์ `truncateAbstract`: ข้อความ 280 ตัวไม่เปลี่ยน, 281 ตัวยาวไม่เกิน 280 และลงท้าย `…`, ไม่ตัดกลางกลุ่มอักษรไทย เทสต์ `toShelfBook`: `/covers/cover-01.svg` ได้ `coverUrl: null`, ปกจริงคง URL, ไม่มีผู้วิจัยได้ `authors: ""`, ไม่พบหมวดหมู่ได้ `categoryName: ""`

ใน `research.homepage.test.ts` เพิ่มเคส `getShelfResearch` ตามรูปแบบเทสต์เดิมในไฟล์: select มี `abstract` และ limit เท่ากับค่าที่ส่ง

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Run: `npx vitest run components/home/shelf/toShelfBook.test.ts lib/data/research.homepage.test.ts`
Expected: FAIL เพราะยังไม่มีโมดูลและฟังก์ชัน

- [ ] **Step 3: ทำให้ผ่าน**

- `queries.ts`: เพิ่ม `SHELF_RESEARCH_SELECT` = select หน้าแรก + `abstract` และ `fetchShelfResearchRows(client, limit)` เรียง `published_at` จากใหม่ไปเก่า `status = published` ไม่แก้ `HOMEPAGE_RESEARCH_SELECT`
- `types.ts`: `RawShelfResearchRow = RawHomepageResearchRow & { abstract: string | null }`
- `mappers.ts`: `mapShelfRowToResearchItem(row)` ใช้ mapper หน้าแรกแล้วเติม `abstract: row.abstract ?? ""`
- `research.server.ts`: `getShelfResearch` ใช้ `createPublicClient()`, `unstable_cache` key `public-shelf-research`, แท็กและ revalidate เดียวกับ `getCachedLatestResearch`, fallback `mockData.getLatestResearch(limit)` เมื่อไม่ได้ตั้งค่า Supabase
- `truncateAbstract` ตัดด้วย `Intl.Segmenter` แบบ grapheme

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run components/home/shelf/toShelfBook.test.ts lib/data/research.homepage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/home/shelf/types.ts components/home/shelf/toShelfBook.ts components/home/shelf/toShelfBook.test.ts lib/data/queries.ts lib/data/types.ts lib/data/mappers.ts lib/data/research.server.ts lib/data/research.homepage.test.ts
git commit -m "feat(home): add shelf data query and ShelfBook mapping"
```

### Task 2: ตรรกะของชั้น

**Files:**
- Create: `components/home/shelf/shelfMath.ts`, `components/home/shelf/capability.ts`
- Test: `components/home/shelf/shelfMath.test.ts`, `components/home/shelf/capability.test.ts`

**Interfaces:**
- Produces (`shelfMath.ts`):
  - `seedFromSlug(slug: string): number` (FNV-1a, uint32)
  - `bookDimensions(seed: number): { height: number; width: number; thickness: number }` ช่วง 1.9–2.4, 1.35–1.7, 0.16–0.34
  - `clothIndex(seed: number, paletteSize: number): number`
  - `layoutBooks(thicknesses: number[], gap?: number): { centers: number[]; totalWidth: number }` ค่าเริ่มต้น gap 0.02
  - `clampOffset(offset: number, centers: number[]): number`
  - `nearestIndex(offset: number, centers: number[]): number`
  - `stepIndex(index: number, delta: number, count: number): number`
  - `decayVelocity(velocity: number, dtMs: number): number`
  - `shouldHandleWheel(deltaX: number, deltaY: number): boolean`
  - `isClick(dragPx: number): boolean`
  - `coverWindow(index: number, count: number, radius?: number): number[]` ค่าเริ่มต้น radius 3
  - `fitText(text: string, maxWidth: number, measure: (s: string) => number): string`
- Produces (`capability.ts`): `shouldEnable3D(input: { webgl2: boolean; saveData?: boolean; deviceMemory?: number }): boolean`, `detectCapability(): Parameters<typeof shouldEnable3D>[0]`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**

```ts
expect(seedFromSlug("a")).toBe(seedFromSlug("a"));
expect(clampOffset(999, [0, 1])).toBe(1);
expect(clampOffset(-999, [0, 1])).toBe(0);
expect(stepIndex(1, 1, 2)).toBe(1);
expect(shouldHandleWheel(10, 2)).toBe(true);
expect(shouldHandleWheel(2, 10)).toBe(false);
expect(shouldHandleWheel(5, 5)).toBe(false);
expect(isClick(6)).toBe(true);
expect(isClick(7)).toBe(false);
expect(coverWindow(0, 16)).toEqual([0, 1, 2, 3]);
expect(coverWindow(15, 16)).toEqual([12, 13, 14, 15]);
expect(fitText("กำลังนี้", 3, (s) => [...s].length)).not.toMatch(/^[ัิ-ฺ็-๎]/);
expect(shouldEnable3D({ webgl2: false })).toBe(false);
expect(shouldEnable3D({ webgl2: true, saveData: true })).toBe(false);
expect(shouldEnable3D({ webgl2: true, deviceMemory: 2 })).toBe(false);
expect(shouldEnable3D({ webgl2: true, deviceMemory: 4 })).toBe(true);
expect(shouldEnable3D({ webgl2: true })).toBe(true);
```

เพิ่มเทสต์: `bookDimensions` อยู่ในช่วงกับ 100 slug, `layoutBooks` ไม่ซ้อนกัน, `decayVelocity` ลดลงจนเข้าใกล้ 0, `fitText` ที่ตัดแล้วลงท้าย `…` และตัดตาม grapheme, `layoutBooks([0.2, 0.3])` กับ 2 เล่มใช้ `clampOffset` ได้

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Run: `npx vitest run components/home/shelf/shelfMath.test.ts components/home/shelf/capability.test.ts`
Expected: FAIL เพราะยังไม่มีโมดูล

- [ ] **Step 3: เขียน `shelfMath.ts` และ `capability.ts`**

ไม่ import React, DOM type ที่ runtime หรือ `three` ส่วน `detectCapability` ป้องกันกรณีไม่มี `navigator`

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run components/home/shelf/shelfMath.test.ts components/home/shelf/capability.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/home/shelf/shelfMath.ts components/home/shelf/shelfMath.test.ts components/home/shelf/capability.ts components/home/shelf/capability.test.ts
git commit -m "feat(home): add shelf layout math and capability check"
```

### Task 3: Hero ใหม่กับรายการลิงก์ fallback

ผลลัพธ์ของ task นี้ใช้งานได้เองโดยยังไม่มี 3D

**Files:**
- Create: `components/home/shelf/StaticShelfList.tsx`, `components/home/shelf/HeroShelf.tsx`, `e2e/home-shelf.spec.ts`
- Modify: `components/home/Hero.tsx`, `app/[locale]/page.tsx`, `messages/th.json`, `messages/en.json`, `messages/lo.json`, `messages/vi.json`

**Interfaces:**
- Consumes: `getShelfResearch`, `SHELF_SIZE`, `toShelfBook`
- Produces: `<HeroShelf books={ShelfBook[]}>{staticList}</HeroShelf>` โดย `StaticShelfList` เป็น server component ที่แต่ละ `<a>` มี `data-shelf-index={n}`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**

ใน `e2e/home-shelf.spec.ts` เทสต์ `shelf list renders real links`: เปิด `/th` แล้วใน `[data-testid="hero-shelf"]` มีลิงก์ `href` ขึ้นต้น `/th/research/` อย่างน้อย 2 ลิงก์ เทสต์ `search stays usable`: ช่องค้นหาของ hero รับพิมพ์ได้ เทสต์ `no horizontal page overflow at 375px`

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Start preview `web` แล้ว Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: FAIL เพราะยังไม่มี `hero-shelf`

- [ ] **Step 3: แก้ data flow**

`page.tsx` เพิ่ม `getShelfResearch(SHELF_SIZE)` เข้า `Promise.all` รอบที่สอง และส่งเป็น `shelf` แทน `latest.slice(0, 3)` `Hero` คง prop `shelf` กับ `allCategories` แล้วแปลงเป็น `ShelfBook` เอง เพราะ `CategoryCover` ต้องการ object `Category`

- [ ] **Step 4: แก้เลย์เอาต์**

ลบคอลัมน์ขวาออกจาก `Hero.tsx` ส่วนข้อความอยู่ใน `Container` ตามเดิม และวางแถบชั้นเต็มความกว้างด้านล่างเมื่อ `shelf.length >= 2` `HeroShelf` เป็น `"use client"` ที่ task นี้เรนเดอร์ `section[data-testid="hero-shelf"]` พร้อม `aria-label` และความสูงตาม Global Constraints ส่วน `StaticShelfList` เป็นแถวเลื่อนแนวนอนใช้ `next/image` แบบ lazy และ `CategoryCover`

- [ ] **Step 5: เพิ่มข้อความ**

เพิ่มใต้ `home` ทั้ง 4 ไฟล์: `shelfLabel`, `shelfPrevious`, `shelfNext`, `shelfPosition` (`{current}`, `{total}`), `shelfInspect`, `shelfClose`, `shelfRead` th: `ชั้นงานวิจัยล่าสุด`, `เล่มก่อนหน้า`, `เล่มถัดไป`, `เล่ม {current} จาก {total}`, `ดูเล่มนี้`, `กลับไปที่ชั้น`, `อ่านงานวิจัย` en: `Latest research shelf`, `Previous book`, `Next book`, `Book {current} of {total}`, `View this book`, `Back to shelf`, `Read research` และแปลภาษาลาวกับเวียดนามให้ความหมายเดียวกัน

- [ ] **Step 6: รันให้ผ่าน**

Run: `npx playwright test e2e/home-shelf.spec.ts` และ `npx tsc --noEmit` และ `npm run lint`
Expected: PASS และไม่มี error

- [ ] **Step 7: Commit**

```bash
git add components/home/shelf/StaticShelfList.tsx components/home/shelf/HeroShelf.tsx e2e/home-shelf.spec.ts components/home/Hero.tsx "app/[locale]/page.tsx" messages/th.json messages/en.json messages/lo.json messages/vi.json
git commit -m "feat(home): move hero shelf to a full-width linked list"
```

### Task 4: Scene หนังสือ 3D

**Files:**
- Create: `components/home/shelf/bookGeometry.ts`, `components/home/shelf/bookTextures.ts`, `components/home/shelf/shelfScene.ts`
- Modify: `components/home/shelf/HeroShelf.tsx`, `package.json`, `package-lock.json`, `e2e/home-shelf.spec.ts`

**Interfaces:**
- Consumes: `shelfMath`, `shouldEnable3D`, `detectCapability`, `ShelfBook`
- Produces:

```ts
interface ShelfSceneOptions {
  reducedMotion: boolean;
  initialIndex: number;
  onSelect(index: number): void;
  onOpen(index: number): void;
  onError(error: unknown): void;
}
interface ShelfSceneHandle {
  goTo(index: number): void;
  inspect(index: number): void;
  closeInspect(): void;
  resize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}
function createShelfScene(canvas: HTMLCanvasElement, books: ShelfBook[], options: ShelfSceneOptions): ShelfSceneHandle;
```

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**

`canvas appears when WebGL is available`: รอ `[data-testid="hero-shelf"] canvas` และ `data-shelf-mode="3d"` `falls back without WebGL`: ใช้ `addInitScript` ให้ `getContext("webgl2")` คืน `null` แล้วยืนยัน `data-shelf-mode="list"` ลิงก์มองเห็นได้ และไม่มี canvas `does not leave a scene after leaving home`: ไปหน้าอื่นทันทีหลังโหลด แล้วไม่มี page error

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: FAIL ที่เคส canvas

- [ ] **Step 3: ติดตั้ง three**

Run: `npm install three` และ `npm install -D @types/three`
Expected: อยู่ใน `package.json` และ `node_modules/three` มีอยู่

- [ ] **Step 4: เขียน `bookGeometry.ts`**

`createBook(book: ShelfBook, seed: number): THREE.Group` ประกอบปกหน้า ปกหลัง สัน เนื้อกระดาษ, `createShelf(totalWidth: number): THREE.Group` เป็นไม้วอลนัต พาเลตต์ผ้า 6 สีหม่นคงที่ในไฟล์นี้

- [ ] **Step 5: เขียน `bookTextures.ts`**

`resolveFontFamilies(): Promise<string>` อ่าน `--font-noto-thai` และ `--font-noto-lao` แล้วรอ `document.fonts.load()`, `drawSpine(book, cloth, fonts): HTMLCanvasElement`, `drawCover(book, cloth, fonts, size): HTMLCanvasElement`, `loadCover(url, width): Promise<THREE.Texture>` ผ่าน `/_next/image?url=…&w=…&q=75` ความกว้าง `w` ต้องเป็นค่าที่อยู่ใน `deviceSizes` หรือ `imageSizes` ของ Next

- [ ] **Step 6: เขียน `shelfScene.ts`**

ตามพฤติกรรมในหัวข้อการโต้ตอบและประสิทธิภาพของ spec ยกเว้นโหมดดูเล่มซึ่งทำใน Task 6: เรนเดอร์เมื่อมีการเปลี่ยนแปลงเท่านั้น, เงาระนาบ, Pointer Events พร้อม `touch-action: pan-y`, wheel ผ่าน `shouldHandleWheel`, `webglcontextlost` เรียก `onError` และ `dispose()` เก็บกวาดทุก resource

- [ ] **Step 7: ต่อเข้า `HeroShelf`**

หลัง `load` ใช้ `requestIdleCallback` และ `IntersectionObserver` (`rootMargin: "200px"`) แล้ว `import("./shelfScene")` เฉพาะเมื่อ `shouldEnable3D` ผ่าน ใช้ flag `cancelled` ใน cleanup เพื่อไม่สร้าง scene หลัง unmount ตั้ง `data-shelf-mode` เป็น `list` หรือ `3d` เมื่อ `3d` ให้รายการเป็น `sr-only` และ canvas `aria-hidden` เมื่อ `onError` ให้กลับเป็น `list`

- [ ] **Step 8: รันให้ผ่าน**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: PASS

- [ ] **Step 9: ตรวจด้วยตา**

เปิด `/th` และ `/lo` ใน browser pane แล้วจับภาพ ยืนยันว่าสระ วรรณยุกต์บนสัน และปกเรียงพิมพ์ถูกต้อง

- [ ] **Step 10: Commit**

```bash
git add components/home/shelf/bookGeometry.ts components/home/shelf/bookTextures.ts components/home/shelf/shelfScene.ts components/home/shelf/HeroShelf.tsx package.json package-lock.json e2e/home-shelf.spec.ts
git commit -m "feat(home): render the hero shelf in Three.js with list fallback"
```

### Task 5: การควบคุมชั้น

**Files:**
- Create: `components/home/shelf/ShelfControls.tsx`
- Modify: `components/home/shelf/HeroShelf.tsx`, `components/home/shelf/shelfScene.ts`, `e2e/home-shelf.spec.ts`

**Interfaces:**
- Consumes: `ShelfSceneHandle`, `stepIndex`
- Produces: `<ShelfControls index count onChange onInspect />` และ `data-shelf-index` บน section เพื่อให้เทสต์อ่านเล่มปัจจุบัน

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**

`buttons move the shelf`: กดถัดไปแล้ว `data-shelf-index` เป็น `1` `arrow keys move the shelf` `previous is disabled at the first book` `position marker jumps to a book` `focusing a list link moves the shelf`: `focus()` ลิงก์เล่มที่ 3 แล้ว index เป็น `2` `vertical wheel scrolls the page`: `mouse.wheel(0, 400)` บนชั้นแล้ว `scrollY > 0` `drag moves the shelf` `resizing keeps the canvas in its band`: ปรับ viewport แล้วขนาด canvas ตรงกับ section

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: FAIL เพราะยังไม่มีปุ่ม

- [ ] **Step 3: เขียน `ShelfControls` และต่อเข้า `HeroShelf`**

ปุ่มสูงอย่างน้อย 44px, แถบตำแหน่งเป็นปุ่มต่อเล่ม, `aria-live="polite"` ใช้ `shelfPosition` กับชื่อเล่ม, `onFocusCapture` อ่าน `data-shelf-index` ของลิงก์, `ResizeObserver` เรียก `resize`, `IntersectionObserver` กับ `visibilitychange` เรียก `setVisible`, ส่ง `reducedMotion` จาก `matchMedia` และรับปุ่มลูกศร/Enter เมื่อโฟกัสอยู่ใน section

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/home/shelf/ShelfControls.tsx components/home/shelf/HeroShelf.tsx components/home/shelf/shelfScene.ts e2e/home-shelf.spec.ts
git commit -m "feat(home): add shelf controls and keyboard navigation"
```

### Task 6: โหมดดูเล่ม

**Files:**
- Create: `components/home/shelf/ShelfInspector.tsx`
- Modify: `components/home/shelf/HeroShelf.tsx`, `components/home/shelf/shelfScene.ts`, `components/home/shelf/bookTextures.ts`, `e2e/home-shelf.spec.ts`

**Interfaces:**
- Consumes: `inspect`, `closeInspect`, `onOpen`, `ShelfBook`
- Produces: `<ShelfInspector book onClose />` เรนเดอร์ใน dialog เต็มจอ

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**

`inspect opens a dialog with book details`: กดดูเล่มแล้วเห็น `role="dialog"` ชื่อเรื่อง และลิงก์ `/th/research/{slug}` `escape closes and restores focus` `page scroll is locked while open` `vertical wheel zooms only while inspecting`: `scrollY` ไม่เปลี่ยน `resize while open keeps canvas full screen` `broken cover falls back`: route รูปปกให้ตอบ 404 แล้วไม่มี page error และยังเปิดดูเล่มได้ `empty abstract hides the abstract block`

- [ ] **Step 2: รันให้เห็นว่าล้มเหลว**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: FAIL เพราะยังไม่มี dialog

- [ ] **Step 3: เพิ่มโหมดดูเล่มใน `shelfScene.ts`**

โหลด `OrbitControls` เฉพาะตอนเปิด ปิด pan เปิดหมุนและซูม โหลดปก 1024×1440 ปิดแล้วคืนกล้องและเล่มกลับตำแหน่ง ถ้า `reducedMotion` ให้ตัดไปตำแหน่งปลายทางทันที

- [ ] **Step 4: เขียน `ShelfInspector` และต่อเข้า `HeroShelf`**

section เปลี่ยนเป็น `fixed inset-0` พร้อม `role="dialog"` `aria-modal="true"`, ดักโฟกัสใน dialog, ล็อก `body` overflow, Esc ปิด, คืนโฟกัส แผงอยู่ขวาที่ ≥1024px และเป็น bottom sheet บนจอเล็ก แสดงหมวดหมู่ ชื่อเรื่อง ผู้วิจัย ปี บทคัดย่อ และลิงก์ `shelfRead` ไม่เรนเดอร์ส่วนที่ไม่มีค่า

- [ ] **Step 5: รันให้ผ่าน**

Run: `npx playwright test e2e/home-shelf.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/home/shelf/ShelfInspector.tsx components/home/shelf/HeroShelf.tsx components/home/shelf/shelfScene.ts components/home/shelf/bookTextures.ts e2e/home-shelf.spec.ts
git commit -m "feat(home): add book inspection dialog"
```

### Task 7: ตรวจรับทั้งสาขา

**Files:**
- Modify: `e2e/accessibility.spec.ts`

- [ ] **Step 1: เพิ่ม axe**

รัน axe บน `/th` ทั้งสถานะปกติและตอนเปิด dialog ตามรูปแบบเดิมในไฟล์

- [ ] **Step 2: รันเทสต์ทั้งหมด**

Run: `npm test`, `npx playwright test e2e/home-shelf.spec.ts e2e/accessibility.spec.ts e2e/public-home-cache.spec.ts`, `npx tsc --noEmit`, `npm run lint`
Expected: ผ่านทั้งหมด ถ้ามีเทสต์ skip เพราะไม่ได้ตั้ง env Supabase ให้รายงานจำนวน

- [ ] **Step 3: วัด bundle**

Run: `npm run build` และ `ANALYZE=true npm run build`
Expected: ไม่พบ `three` ใน first-load ของหน้าแรก JS แรกเพิ่มไม่เกิน 10 KB gzip และจดขนาด chunk 3D

- [ ] **Step 4: ตรวจด้วยตา**

จับภาพ 375px, 768px, เดสก์ท็อป ทั้งธีมสว่างและมืด กับ `/th`, `/en`, `/lo`, `/vi` รวมถึง reduced motion และยืนยันว่าไม่มี layout shift ตอนสลับเป็น 3D

- [ ] **Step 5: Commit**

```bash
git add e2e/accessibility.spec.ts
git commit -m "test(home): cover the 3D shelf with axe checks"
```

"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdfjs-dist/react-pageflip อ้างอิง API ของเบราว์เซอร์โดยตรง — ถ้าปล่อยให้
// Next.js server-render component นี้ในรอบแรก (แม้จะเป็น "use client" ก็ตาม
// เพราะ React ยัง render client component ฝั่งเซิร์ฟเวอร์เพื่อสร้าง HTML แรก)
// จะพังด้วย error ที่เข้าใจยากจากภายใน pdfjs-dist จึงต้องปิด SSR ของ
// component นี้โดยเฉพาะผ่าน next/dynamic (ต้องทำใน client component
// เพราะ ssr:false ใช้ใน Server Component โดยตรงไม่ได้)
const FlipbookViewer = dynamic(() => import("./FlipbookViewer"), {
  ssr: false,
  // ใช้ค่าสีตรงเดียวกับโหมด dark ของ .reader-shell (ค่าเริ่มต้นของ
  // FlipbookViewer เอง) ไว้ตรงๆ แทนที่จะพึ่ง CSS custom property — ช่วง
  // นี้ FlipbookViewer (ซึ่งเป็นเจ้าของ toggle) ยังไม่ mount จึงยังไม่มี
  // element ที่ประกาศ --reader-* ให้ inherit
  loading: () => (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-3 rounded-xl border border-[#263252] bg-[#111a2e] sm:min-h-[75vh]">
      <Loader2 className="h-6 w-6 animate-spin text-[#aab4cc]" />
      <p className="text-sm text-[#eef1f8]">กำลังเตรียมตัวอ่านหนังสือ...</p>
    </div>
  ),
});

export default function FlipbookViewerLoader(props: {
  fileUrl: string;
  titleTh: string;
  downloadUrl?: string;
  downloadDisabled?: boolean;
}) {
  return <FlipbookViewer {...props} />;
}

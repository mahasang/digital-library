import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, FileSearch, ImageOff } from "lucide-react";
import Container from "@/components/ui/Container";
import FlipbookViewer from "@/components/research/FlipbookViewerLoader";
import { getResearchById, getMergedRedirectSlug } from "@/lib/data/research.server";
import { canDownload, canReadOnline } from "@/lib/labels";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getResearchReadUrl, getResearchDownloadUrl } from "@/lib/storage/signed-url.server";
import { getExtractionStatusBySlug } from "@/lib/pdf/extraction-status.server";
import { getMyActiveGrantsBySlug } from "@/lib/data/access-grants.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getResearchById(id);
  if (!item) return { title: "ไม่พบงานวิจัย" };
  return { title: `อ่าน: ${item.titleTh}` };
}

export default async function ReadResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getResearchById(id);
  if (!item || item.status !== "published") {
    const redirectSlug = await getMergedRedirectSlug(id);
    if (redirectSlug) redirect(`/research/${redirectSlug}/read`);
    notFound();
  }

  // grants = สิทธิ์เสริมจากระบบขอสิทธิ์เข้าถึงเอกสาร (ช่วงที่ 18) — OR เข้ากับ
  // canReadOnline/canDownload(access_level) เดิมเสมอ ไม่เคยแทนที่ค่าเดิม
  const grants = isSupabaseConfigured()
    ? await getMyActiveGrantsBySlug(item.id)
    : { read: false, download: false };
  if (!canReadOnline(item.accessLevel) && !grants.read) {
    notFound();
  }

  let fileUrl = item.pdfFile;
  let downloadUrl: string | undefined;
  let fileError: string | null = null;
  const extraction = isSupabaseConfigured() ? await getExtractionStatusBySlug(item.id) : null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error: historyError } = await supabase.rpc("log_reading_history", {
      p_slug: item.id,
    });
    if (historyError) {
      console.error("log_reading_history failed:", historyError.message);
    }

    const readResult = await getResearchReadUrl(
      item.pdfFile,
      item.accessLevel,
      grants.read,
      item.scanStatus
    );
    if (readResult.error || !readResult.url) {
      fileError = readResult.error;
    } else {
      fileUrl = readResult.url;
      if (canDownload(item.accessLevel) || grants.download) {
        const downloadResult = await getResearchDownloadUrl(
          item.pdfFile,
          item.accessLevel,
          undefined,
          grants.download,
          item.scanStatus
        );
        downloadUrl = downloadResult.url ?? undefined;
      }
    }
  }

  return (
    <section className="bg-gray-100 py-6 sm:py-8">
      <Container>
        <Link
          href={`/research/${item.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้ารายละเอียดงานวิจัย
        </Link>

        <h1 className="mb-1 line-clamp-1 text-h2 font-semibold text-gray-900">
          {item.titleTh}
        </h1>
        <p className="mb-3 text-xs text-gray-500">
          {item.researchers.map((r) => r.name).join(", ")} · {item.year}
        </p>

        {(extraction?.status === "completed" || extraction?.ocrStatus === "completed") && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-accent">
            <FileSearch className="h-3.5 w-3.5" />
            ค้นหาข้อความภายในเอกสารนี้ได้ที่หน้า{" "}
            <Link href="/research" className="underline hover:text-accent-strong">
              ค้นหางานวิจัย
            </Link>
            {extraction?.ocrStatus === "completed" && extraction.status !== "completed" && (
              <span className="text-gray-500">(ข้อความจากการทำ OCR อาจมีความคลาดเคลื่อน)</span>
            )}
          </p>
        )}
        {extraction?.status === "no_text_found" && extraction.ocrStatus !== "completed" && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
            <ImageOff className="h-3.5 w-3.5" />
            เอกสารนี้อาจเป็นไฟล์สแกนหรือไม่มีข้อความที่คัดลอกได้ จึงยังไม่รองรับการค้นหาเนื้อหาภายในไฟล์
          </p>
        )}

        {fileError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </span>
            <p className="text-sm font-semibold text-amber-800">
              ไม่สามารถเปิดเอกสารได้ในขณะนี้
            </p>
            <p className="text-xs text-amber-700">{fileError}</p>
          </div>
        ) : (
          <FlipbookViewer
            fileUrl={fileUrl}
            titleTh={item.titleTh}
            downloadUrl={downloadUrl}
            downloadDisabled={!canDownload(item.accessLevel) && !grants.download}
          />
        )}
      </Container>
    </section>
  );
}

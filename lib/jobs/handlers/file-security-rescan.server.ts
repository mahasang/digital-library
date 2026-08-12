import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { validateFileSignature } from "@/lib/security/file-signature.server";
import { scanFileForMalware, isMalwareScanRequired } from "@/lib/security/malware-scanner.server";
import { PDF_ALLOWED_TYPES } from "@/lib/storage/limits";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import { getSettings } from "@/lib/data/settings.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `file_security_rescan` — ใช้ทั้งตอนสแกนไฟล์ PDF ครั้งแรกหลัง
 * อัปโหลด (แทนการสแกน synchronous ก่อน insert แบบเดิม) และตอน Super Admin สั่ง
 * สแกนซ้ำไฟล์เดิมเป็นชุดที่ /superadmin/file-security — ดาวน์โหลดไฟล์ปัจจุบัน
 * จาก Storage แล้วตรวจ magic-byte + สแกนมัลแวร์เหมือนเดิมทุกประการ (ดู
 * lib/security/validate-upload.server.ts) เพียงแต่ทำงานหลังจากแถว research_items
 * มีอยู่แล้ว ไม่ใช่ก่อน insert
 *
 * หากพบว่าไฟล์ไม่ปลอดภัย (infected/error) และงานวิจัยกำลังเผยแพร่อยู่ trigger
 * close_access_on_scan_failure() ของฐานข้อมูลจะปิดการเข้าถึง (เปลี่ยนเป็น
 * archived) ให้อัตโนมัติทันทีที่ update scan_status — handler นี้แค่บันทึกผล +
 * แจ้งเตือนผู้ดูแลเท่านั้น ไม่ต้องเปลี่ยนสถานะเอง
 */
export async function handleFileSecurityRescanJob(job: BackgroundJobRow): Promise<boolean> {
  const researchItemId = String(job.payload.research_item_id ?? "");
  const pdfPath = String(job.payload.pdf_path ?? "");

  if (!researchItemId || !pdfPath) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (research_item_id/pdf_path)");
    return false;
  }

  const service = createServiceRoleClient();

  try {
    const { data: existing } = await service
      .from("research_items")
      .select("id, status, title_th, scan_status")
      .eq("id", researchItemId)
      .maybeSingle();

    if (!existing) {
      // แถวถูกลบไปแล้ว (เช่น ยกเลิกงานวิจัยระหว่างรอคิว) ไม่ถือเป็นความล้มเหลว
      await completeBackgroundJob(job.id);
      return true;
    }

    const { data: blob, error: downloadError } = await service.storage
      .from("research-documents")
      .download(pdfPath);

    if (downloadError || !blob) {
      await applyScanResult(service, researchItemId, {
        scan_status: "error",
        scan_provider: "file_security_rescan",
        scan_reason: "ไม่พบไฟล์ที่จะสแกน อาจถูกแทนที่หรือลบไปแล้ว",
      });
      await notifyIfPublishedAndUnsafe(service, existing, "error");
      await failBackgroundJob(job.id, "ไม่สามารถดาวน์โหลดไฟล์เพื่อสแกนความปลอดภัยได้");
      return false;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const declaredMimeType = blob.type || "application/pdf";

    const signatureResult = validateFileSignature(
      new Uint8Array(buffer),
      declaredMimeType,
      PDF_ALLOWED_TYPES
    );

    if (!signatureResult.ok) {
      await applyScanResult(service, researchItemId, {
        scan_status: "error",
        scan_provider: "file_security_rescan",
        scan_reason: signatureResult.reason ?? "ชนิดไฟล์ไม่ตรงกับที่ประกาศไว้",
      });
      await notifyIfPublishedAndUnsafe(service, existing, "error");
      await completeBackgroundJob(job.id);
      return true;
    }

    const filename = pdfPath.split("/").pop() ?? pdfPath;
    const scanOutcome = await scanFileForMalware(buffer, filename);

    if (scanOutcome.status === "error" && isMalwareScanRequired()) {
      await applyScanResult(service, researchItemId, {
        scan_status: "error",
        scan_provider: scanOutcome.provider,
        scan_reason: scanOutcome.reason ?? "ระบบสแกนไฟล์ขัดข้องชั่วคราว",
      });
      await notifyIfPublishedAndUnsafe(service, existing, "error");
      await failBackgroundJob(job.id, "ระบบสแกนไฟล์ขัดข้องชั่วคราว จะลองสแกนใหม่อีกครั้ง");
      return false;
    }

    await applyScanResult(service, researchItemId, {
      scan_status: scanOutcome.status,
      scan_provider: scanOutcome.provider,
      scan_reason: scanOutcome.reason ?? null,
    });

    if (scanOutcome.status === "infected") {
      await notifyIfPublishedAndUnsafe(service, existing, "infected");
    }

    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handleFileSecurityRescanJob"));
    return false;
  }
}

async function applyScanResult(
  service: ReturnType<typeof createServiceRoleClient>,
  researchItemId: string,
  scan: { scan_status: "clean" | "infected" | "error" | "skipped"; scan_provider: string; scan_reason: string | null }
): Promise<void> {
  const { error } = await service
    .from("research_items")
    .update({
      scan_status: scan.scan_status,
      scanned_at: new Date().toISOString(),
      scan_provider: scan.scan_provider,
      scan_reason: scan.scan_reason,
    })
    .eq("id", researchItemId);
  if (error) {
    console.error("handleFileSecurityRescanJob: บันทึกผลสแกนไม่สำเร็จ:", error.message);
  }
}

async function notifyIfPublishedAndUnsafe(
  service: ReturnType<typeof createServiceRoleClient>,
  item: { id: string; status: string; title_th: string },
  reason: "infected" | "error"
): Promise<void> {
  if (item.status !== "published") return;

  await service.from("audit_logs").insert({
    actor_id: null,
    action: "file_security_rescan_closed_access",
    entity_type: "research_items",
    entity_id: item.id,
    metadata: { reason, title_th: item.title_th },
  });

  const settings = await getSettings();
  if (!settings.notificationsInAppEnabled) return;

  const { data: adminRoles } = await service.from("roles").select("id").gte("rank", 40);
  const roleIds = (adminRoles ?? []).map((r) => r.id);
  if (roleIds.length === 0) return;

  const { data: adminUserRoles } = await service
    .from("user_roles")
    .select("user_id")
    .in("role_id", roleIds);
  const adminUserIds = Array.from(new Set((adminUserRoles ?? []).map((r) => r.user_id)));
  if (adminUserIds.length === 0) return;

  const message =
    reason === "infected"
      ? `ตรวจพบความเสี่ยงด้านความปลอดภัยในไฟล์ของงานวิจัย "${item.title_th}" ระบบปิดการเข้าถึงอัตโนมัติแล้ว กรุณาตรวจสอบ`
      : `สแกนความปลอดภัยไฟล์ของงานวิจัย "${item.title_th}" ไม่สำเร็จ ระบบปิดการเข้าถึงอัตโนมัติแล้ว กรุณาตรวจสอบ`;

  await service.from("notifications").insert(
    adminUserIds.map((userId) => ({
      user_id: userId,
      title: "ไฟล์งานวิจัยถูกปิดการเข้าถึงอัตโนมัติ",
      message,
      type: "warning" as const,
      research_id: item.id,
    }))
  );
}

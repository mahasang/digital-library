"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle, Link2, ExternalLink, Info } from "lucide-react";
import { startOrcidConnectAction } from "@/app/[locale]/account/orcid-actions";
import { idleActionResult } from "@/lib/actions/types";
import { orcidProfileUrl } from "@/lib/validation/orcid";
import type { MyOrcidStatus } from "@/lib/data/orcid-profile.server";

const STATUS_MESSAGE: Record<string, { tone: "green" | "amber" | "red"; text: string }> = {
  connected: { tone: "green", text: "เชื่อมต่อ ORCID สำเร็จแล้ว" },
  cancelled: { tone: "amber", text: "ยกเลิกการเชื่อมต่อ ORCID แล้ว ไม่มีการเปลี่ยนแปลงข้อมูลใดๆ" },
  error: { tone: "red", text: "เชื่อมต่อ ORCID ไม่สำเร็จ" },
};

/**
 * ปุ่ม "เชื่อม ORCID" ที่หน้า /account — แสดงผลตามสถานะที่เป็นไปได้ 4 แบบ:
 * (1) บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลผู้วิจัยเลย (2) ยังไม่ได้ตั้งค่า ORCID
 * OAuth ฝั่งผู้ดูแลระบบ (3) เชื่อมแล้ว (4) ยังไม่ได้เชื่อม พร้อมปุ่มให้กด
 */
export default function OrcidConnect({
  status,
  isConfigured,
  redirectStatus,
  redirectReason,
}: {
  status: MyOrcidStatus | null;
  isConfigured: boolean;
  redirectStatus?: string;
  redirectReason?: string;
}) {
  const [state, formAction, pending] = useActionState(startOrcidConnectAction, idleActionResult);

  const banner = redirectStatus ? STATUS_MESSAGE[redirectStatus] : null;

  if (!status) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        บัญชีของคุณยังไม่ได้เชื่อมกับข้อมูลผู้วิจัยในระบบ — หากคุณเป็นผู้วิจัยที่มีผลงานในห้องสมุดนี้
        กรุณาติดต่อเจ้าหน้าที่ห้องสมุดเพื่อเชื่อมบัญชีให้ก่อน
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {banner && (
        <p
          className={`flex items-center gap-1.5 rounded-lg p-2.5 text-xs font-medium ${
            banner.tone === "green"
              ? "bg-green-50 text-green-700"
              : banner.tone === "amber"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {banner.tone === "green" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {banner.text}
          {redirectReason ? ` — ${redirectReason}` : ""}
        </p>
      )}

      {status.orcidOauthVerifiedAt && status.orcid ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            เชื่อมต่อ ORCID แล้ว (ยืนยันผ่าน ORCID OAuth จริง)
          </p>
          <a
            href={orcidProfileUrl(status.orcid)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 hover:underline"
          >
            {status.orcid}
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-[11px] text-green-600">
            ยืนยันเมื่อ {new Date(status.orcidOauthVerifiedAt).toLocaleString("th-TH")}
          </p>
        </div>
      ) : (
        <>
          {status.orcid && (
            <p className="text-xs text-gray-500">
              ระบบมี ORCID {status.orcid} บันทึกไว้แล้ว (
              {status.orcidVerifiedAt ? "เจ้าหน้าที่ยืนยันด้วยตนเอง" : "ยังไม่ได้ยืนยัน"}) — เชื่อมต่อผ่าน
              ORCID OAuth เพื่อยืนยันตัวตนที่น่าเชื่อถือกว่าเดิม
            </p>
          )}

          {!isConfigured ? (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ผู้ดูแลระบบยังไม่ได้ตั้งค่า ORCID OAuth — ปุ่มเชื่อมต่อจะใช้งานได้เมื่อตั้งค่า
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">ORCID_CLIENT_ID</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5">ORCID_CLIENT_SECRET</code>{" "}
              เรียบร้อยแล้ว
            </div>
          ) : (
            <form action={formAction}>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#A6CE39] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="h-4 w-4" />
                {pending ? "กำลังนำไปยัง ORCID..." : "เชื่อม ORCID"}
              </button>
            </form>
          )}

          {state.status === "error" && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {state.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

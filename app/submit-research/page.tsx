import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import SubmitResearchForm from "@/components/submission/SubmitResearchForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getOrganizations } from "@/lib/data/organizations.server";
import { getCategories } from "@/lib/data/categories.server";
import { getSettings } from "@/lib/data/settings.server";
import { isCaptchaConfigured } from "@/lib/captcha.server";
import { submitResearchAction } from "@/app/submit-research/actions";

export const metadata: Metadata = {
  title: "ส่งงานวิจัย",
  description: "ส่งงานวิจัยของคุณเข้าสู่ระบบเพื่อรอการตรวจสอบและอนุมัติเผยแพร่",
};

export default async function SubmitResearchPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/submit-research");

  const [organizations, categories, settings] = await Promise.all([
    getOrganizations(),
    getCategories(),
    getSettings(),
  ]);

  const captchaSiteKey =
    settings.captchaEnabled && isCaptchaConfigured()
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ส่งงานวิจัย</h1>
        <p className="mt-1 text-sm text-gray-500">
          กรอกข้อมูลงานวิจัยและอัปโหลดไฟล์ให้ครบถ้วน แล้วเลือกบันทึกฉบับร่างหรือส่งตรวจสอบ
        </p>

        <div className="mt-8">
          <SubmitResearchForm
            userId={user.id}
            organizations={organizations}
            categories={categories}
            submitAction={submitResearchAction}
            fileLimits={{
              maxPdfSizeMb: settings.maxPdfSizeMb,
              maxCoverSizeMb: settings.maxCoverSizeMb,
              maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
            }}
            captchaSiteKey={captchaSiteKey}
          />
        </div>
      </Container>
    </div>
  );
}

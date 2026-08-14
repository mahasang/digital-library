import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/ui/Container";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import NotificationSettingsForm from "@/components/profile/NotificationSettingsForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getMyNotificationPreferences } from "@/lib/data/notification-preferences.server";
import { getMySubscribedCategoryIds } from "@/lib/data/category-subscriptions.server";
import { getActiveCategoriesWithId } from "@/lib/data/categories.server";
import { isEmailProviderConfigured } from "@/lib/notifications/email.server";

export const metadata: Metadata = {
  title: "ตั้งค่าการแจ้งเตือน",
  description: "จัดการการแจ้งเตือนงานวิจัยใหม่ตามหมวดหมู่และคำขอเข้าถึงเอกสาร",
};

export default async function NotificationSettingsPage() {
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
  if (!user) redirect("/login?redirect=/profile/notification-settings");

  const [preferences, subscribedCategoryIds, categories] = await Promise.all([
    getMyNotificationPreferences(),
    getMySubscribedCategoryIds(),
    getActiveCategoriesWithId(),
  ]);

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-2xl">
        <Link
          href="/account"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปโปรไฟล์ของฉัน
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ตั้งค่าการแจ้งเตือน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เลือกหมวดหมู่งานวิจัยที่ต้องการติดตาม และช่องทางการแจ้งเตือนที่ต้องการรับ
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-surface p-5">
          <NotificationSettingsForm
            preferences={preferences}
            categories={categories}
            subscribedCategoryIds={subscribedCategoryIds}
            emailProviderConfigured={isEmailProviderConfigured()}
          />
        </div>
      </Container>
    </div>
  );
}

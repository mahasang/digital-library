import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import AccountShell from "@/components/account/AccountShell";
import AccountEmptyState from "@/components/account/AccountEmptyState";
import AccountResearchRow from "@/components/account/AccountResearchRow";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import Container from "@/components/ui/Container";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getReadingHistory } from "@/lib/data/favorites.server";

export const metadata: Metadata = {
  title: "ประวัติการอ่าน",
  description: "งานวิจัยที่คุณเคยเปิดอ่านล่าสุด",
};

export default async function ReadingHistoryPage() {
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
  if (!user) redirect("/login?redirect=/reading-history");

  const history = await getReadingHistory(user.id);

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">ประวัติการอ่าน</h1>
      <p className="mt-1 text-sm text-gray-500">
        งานวิจัยที่คุณเปิดอ่านล่าสุด (แสดง 50 รายการล่าสุด)
      </p>

      <div className="mt-6">
        {history.length === 0 ? (
          <AccountEmptyState
            icon={BookOpen}
            title="ยังไม่มีประวัติการอ่าน"
            description="เมื่อคุณเปิดอ่านงานวิจัยออนไลน์ ระบบจะบันทึกประวัติไว้ที่นี่"
            action={
              <LinkButton href="/research" variant="primary" size="sm">
                ค้นหางานวิจัย
              </LinkButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {history.map(({ item, readAt }, index) => (
              <AccountResearchRow key={`${item.id}-${index}`} item={item} readAt={readAt} />
            ))}
          </div>
        )}
      </div>
    </AccountShell>
  );
}

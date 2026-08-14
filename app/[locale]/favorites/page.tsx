import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import AccountShell from "@/components/account/AccountShell";
import AccountEmptyState from "@/components/account/AccountEmptyState";
import AccountResearchRow from "@/components/account/AccountResearchRow";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import Container from "@/components/ui/Container";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getFavoriteResearch } from "@/lib/data/favorites.server";

export const metadata: Metadata = {
  title: "รายการโปรด",
  description: "งานวิจัยที่คุณบันทึกไว้ในรายการโปรด",
};

export default async function FavoritesPage() {
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
  if (!user) redirect("/login?redirect=/favorites");

  const items = await getFavoriteResearch(user.id);

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">รายการโปรด</h1>
      <p className="mt-1 text-sm text-gray-500">งานวิจัยที่คุณบันทึกไว้เพื่อดูภายหลัง</p>

      <div className="mt-6">
        {items.length === 0 ? (
          <AccountEmptyState
            icon={Heart}
            title="ยังไม่มีรายการโปรด"
            description={'กดปุ่ม "เพิ่มในรายการโปรด" จากหน้ารายละเอียดงานวิจัยที่สนใจ'}
            action={
              <LinkButton href="/research" variant="primary" size="sm">
                ค้นหางานวิจัย
              </LinkButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <AccountResearchRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </AccountShell>
  );
}

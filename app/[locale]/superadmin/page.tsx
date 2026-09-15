export const dynamic = "force-dynamic";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function SuperAdminIndexPage() {
  const locale = await getLocale();
  return redirect({ href: "/superadmin/overview", locale });
}

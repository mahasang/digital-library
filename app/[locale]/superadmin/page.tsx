export const dynamic = "force-dynamic";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { permanentRedirect } from "next/navigation"

export default function SuperAdminIndexPage() {
  permanentRedirect("./overview")
}

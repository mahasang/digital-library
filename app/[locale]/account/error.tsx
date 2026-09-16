"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import AccountShell from "@/components/account/AccountShell";
import AccountErrorState from "@/components/account/AccountErrorState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("account");
  useEffect(() => {
    console.error("account page error:", error);
  }, [error]);

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">{t("heading")}</h1>
      <div className="mt-6">
        <AccountErrorState reset={reset} />
      </div>
    </AccountShell>
  );
}

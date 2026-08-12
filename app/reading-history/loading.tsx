import AccountShell from "@/components/account/AccountShell";
import AccountLoadingState from "@/components/account/AccountLoadingState";

export default function Loading() {
  return (
    <AccountShell>
      <div className="h-7 w-48 animate-pulse rounded bg-gray-200" aria-hidden="true" />
      <div className="mt-6">
        <AccountLoadingState />
      </div>
    </AccountShell>
  );
}

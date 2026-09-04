"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteAccountAction } from "@/app/[locale]/account/actions";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (result.error) {
        setError(result.error);
        setConfirmed(false);
        return;
      }
      router.push('/');
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmed && (
        <p className="text-xs text-red-600 font-medium">
          ການດຳເນີນການນີ້ບໍ່ສາມາດຍົກເລີກໄດ້ — ກົດອີກຄັ້ງເພື່ອຢືນຢັນ
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          confirmed
            ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
            : 'border-red-200 text-red-600 hover:bg-red-50'
        }`}
      >
        {isPending
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Trash2 className="h-4 w-4" />}
        {confirmed ? 'ຢືນຢັນລຶບບັນຊີ' : 'ລຶບບັນຊີ'}
      </button>
    </div>
  );
}

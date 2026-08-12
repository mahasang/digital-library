import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "ไม่มีสิทธิ์เข้าถึง" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <Container className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-bold text-gray-900">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-2 text-sm text-gray-500">
          บัญชีของคุณไม่มีสิทธิ์เพียงพอสำหรับการเข้าถึงหน้านี้
          หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <div className="mt-6 flex gap-3">
          <LinkButton href="/" variant="primary">
            กลับหน้าแรก
          </LinkButton>
          <LinkButton href="/account" variant="outline">
            โปรไฟล์ของฉัน
          </LinkButton>
        </div>
      </Container>
    </div>
  );
}

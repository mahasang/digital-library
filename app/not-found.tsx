import Link from "next/link";
import { FileSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <Container className="flex max-w-md flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <FileSearch className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-bold text-gray-900">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="mt-2 text-sm text-gray-500">
          หน้านี้อาจถูกย้าย ลบ หรือไม่มีอยู่ในระบบ กรุณาตรวจสอบลิงก์อีกครั้ง
        </p>
        <div className="mt-6 flex gap-3">
          <LinkButton href="/" variant="primary">
            กลับหน้าแรก
          </LinkButton>
          <LinkButton href="/research" variant="outline">
            ค้นหางานวิจัย
          </LinkButton>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          หรือดู{" "}
          <Link href="/research" className="underline">
            รายการงานวิจัยทั้งหมด
          </Link>
        </p>
      </Container>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Container from "@/components/ui/Container";

export default function AuthFormShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 py-12">
      <Container className="flex max-w-md flex-col items-center">
        <Link href="/" aria-label="กลับสู่หน้าแรก" className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
        </Link>

        <div className="w-full rounded-2xl border border-gray-200 bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1.5 text-sm text-gray-500">{description}</p>
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}
        </div>
      </Container>
    </div>
  );
}

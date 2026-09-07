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
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-surface py-12">

      {/* ── Concentric circles background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[600, 500, 400, 300, 200].map((size) => (
          <span
            key={size}
            className="absolute rounded-full border border-gray-200"
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      <Container className="relative flex max-w-md flex-col items-center">

        {/* ── Logo icon ── */}
        <Link href="/" aria-label="กລับສູ່ໜ້າທຳອິດ" className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100 shadow-sm">
            <BookOpen className="h-7 w-7 text-brand-600" />
          </span>
        </Link>

        {/* ── Card ── */}
        <div className="w-full">
          {/* Title */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
          </div>

          {/* Form content */}
          {children}

          {/* Footer */}
          {footer && (
            <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>
          )}
        </div>
      </Container>
    </div>
  );
}
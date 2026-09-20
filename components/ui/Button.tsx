import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-md hover:-translate-y-px active:scale-[0.98] active:shadow-none active:translate-y-0 focus-visible:outline-brand-600",
  secondary:
    "bg-accent-soft text-accent-ink hover:bg-accent-soft-hover hover:shadow-sm active:scale-[0.98] focus-visible:outline-brand-600",
  outline:
    "border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-sm active:scale-[0.98] focus-visible:outline-brand-600",
  ghost: "text-gray-700 hover:bg-gray-100 active:scale-[0.97] focus-visible:outline-brand-600",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

// transform + transition-all (ไม่ใช่แค่ transition-colors) เพราะตอนนี้แต่ละ
// variant มี hover:shadow/-translate-y และ active:scale เพิ่มมาด้วย ต้อง
// animate ทั้ง transform และ shadow ไปพร้อมสีตอน hover/active — disabled ไม่
// ต้องมี disabled:shadow-none/scale-100 ซ้ำเพราะปุ่ม <button disabled> จริงไม่
// trigger :hover/:active ในเบราว์เซอร์อยู่แล้วโดยธรรมชาติ
const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transform transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

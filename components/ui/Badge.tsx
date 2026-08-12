import type { ReactNode } from "react";

type BadgeTone = "brand" | "green" | "amber" | "red" | "gray" | "purple";

const toneClasses: Record<BadgeTone, string> = {
  brand: "bg-accent-soft text-accent-ink ring-brand-600/20",
  green: "bg-green-50 text-green-700 ring-green-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-gray-100 text-gray-700 ring-gray-500/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
};

export default function Badge({
  children,
  tone = "gray",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

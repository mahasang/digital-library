"use client";

import {
  CheckCircle2,
  Clock,
  FileEdit,
  Archive,
  Globe,
  RotateCcw,
  XCircle,
  GitMerge,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import type { DocumentStatus } from "@/types/research";

const config: Record<
  DocumentStatus,
  { tone: "green" | "brand" | "purple" | "amber" | "gray" | "red"; icon: typeof Clock }
> = {
  draft: { tone: "gray", icon: FileEdit },
  pending_review: { tone: "amber", icon: Clock },
  revision_requested: { tone: "purple", icon: RotateCcw },
  approved: { tone: "brand", icon: CheckCircle2 },
  published: { tone: "green", icon: Globe },
  rejected: { tone: "red", icon: XCircle },
  archived: { tone: "gray", icon: Archive },
  merged: { tone: "gray", icon: GitMerge },
};

export default function StatusBadge({
  status,
  className = "",
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const { tone, icon: Icon } = config[status];
  const tStatuses = useTranslations("statuses");
  return (
    <Badge tone={tone} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {tStatuses(status)}
    </Badge>
  );
}

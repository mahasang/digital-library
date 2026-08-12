import { Globe, Users, Building2, Eye, FileText } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { accessLevelLabels } from "@/lib/labels";
import type { AccessLevel } from "@/types/research";

const config: Record<
  AccessLevel,
  { tone: "green" | "brand" | "purple" | "amber" | "gray"; icon: typeof Globe }
> = {
  public: { tone: "green", icon: Globe },
  member_only: { tone: "brand", icon: Users },
  staff_only: { tone: "purple", icon: Building2 },
  read_only: { tone: "amber", icon: Eye },
  metadata_only: { tone: "gray", icon: FileText },
};

export default function AccessBadge({
  accessLevel,
  className = "",
}: {
  accessLevel: AccessLevel;
  className?: string;
}) {
  const { tone, icon: Icon } = config[accessLevel];
  return (
    <Badge tone={tone} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {accessLevelLabels[accessLevel]}
    </Badge>
  );
}

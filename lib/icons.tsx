import {
  Cog,
  Cpu,
  LineChart,
  HeartPulse,
  GraduationCap,
  Users,
  Leaf,
  FlaskConical,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export const categoryIconMap: Record<string, LucideIcon> = {
  Cog,
  Cpu,
  LineChart,
  HeartPulse,
  GraduationCap,
  Users,
  Leaf,
  FlaskConical,
};

export function getCategoryIcon(icon: string): LucideIcon {
  return categoryIconMap[icon] ?? BookOpen;
}

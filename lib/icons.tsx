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
  Landmark,
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
  Landmark,
};

export function getCategoryIcon(icon: string): LucideIcon {
  return categoryIconMap[icon] ?? BookOpen;
}

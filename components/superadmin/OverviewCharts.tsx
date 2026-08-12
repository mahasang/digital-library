"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimeSeriesPoint, ViewsDownloadsPoint, CategoryCount } from "@/lib/data/superadmin-charts.server";
import { buildStatusPieChartData, type StatusCount } from "@/lib/charts/statusPieChart";
import type { DocumentStatus } from "@/types/research";

const BRAND = "#185ff2";
const AMBER = "#d97706";
const GREEN = "#16a34a";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "#9ca3af",
  pending_review: "#d97706",
  revision_requested: "#f59e0b",
  approved: "#2f7dff",
  published: "#16a34a",
  rejected: "#dc2626",
  archived: "#6b7280",
  merged: "#a1a1aa",
};

/**
 * Recharts SVG presentation attributes (stroke/fill on CartesianGrid, tick
 * text, Tooltip/Legend content) don't reliably resolve CSS custom
 * properties, so chart chrome colors need explicit light/dark values
 * computed here rather than left as var()-based Tailwind classes.
 */
function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return {
    grid: dark ? "#334155" : "#f1f5f9",
    tick: dark ? "#94a3b8" : "#6b7280",
    tooltipContentStyle: {
      backgroundColor: dark ? "#1e293b" : "#ffffff",
      border: `1px solid ${dark ? "#334155" : "#e5e7eb"}`,
      borderRadius: 8,
      fontSize: 12,
      color: dark ? "#f1f5f9" : "#111827",
    },
    tooltipLabelStyle: { color: dark ? "#f1f5f9" : "#111827" },
    tooltipItemStyle: { color: dark ? "#e2e8f0" : "#374151" },
    legendStyle: { fontSize: 12, color: dark ? "#cbd5e1" : "#374151" },
  };
}

function formatBucketLabel(bucket: string): string {
  // "YYYY-MM-DD" -> "D/M", "YYYY-MM" -> "M/YYYY"
  const parts = bucket.split("-");
  if (parts.length === 3) return `${Number(parts[2])}/${Number(parts[1])}`;
  return `${Number(parts[1])}/${parts[0]}`;
}

export function MembersLineChart({ data }: { data: TimeSeriesPoint[] }) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({ label: formatBucketLabel(d.bucket), count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.tick }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.tick }} />
        <Tooltip
          contentStyle={colors.tooltipContentStyle}
          labelStyle={colors.tooltipLabelStyle}
          itemStyle={colors.tooltipItemStyle}
        />
        <Line type="monotone" dataKey="count" name="สมาชิกใหม่" stroke={BRAND} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ViewsDownloadsLineChart({ data }: { data: ViewsDownloadsPoint[] }) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({
    label: formatBucketLabel(d.bucket),
    views: d.views,
    downloads: d.downloads,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.tick }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.tick }} />
        <Tooltip
          contentStyle={colors.tooltipContentStyle}
          labelStyle={colors.tooltipLabelStyle}
          itemStyle={colors.tooltipItemStyle}
        />
        <Legend wrapperStyle={colors.legendStyle} />
        <Line type="monotone" dataKey="views" name="เข้าชม" stroke={BRAND} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="downloads" name="ดาวน์โหลด" stroke={AMBER} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data }: { data: CategoryCount[] }) {
  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: colors.tick }} />
        <YAxis
          type="category"
          dataKey="categoryName"
          width={140}
          tick={{ fontSize: 11, fill: colors.tick }}
        />
        <Tooltip
          contentStyle={colors.tooltipContentStyle}
          labelStyle={colors.tooltipLabelStyle}
          itemStyle={colors.tooltipItemStyle}
        />
        <Bar dataKey="count" name="จำนวนงานวิจัย" fill={GREEN} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: StatusCount[] }) {
  const colors = useChartColors();
  const chartData = buildStatusPieChartData(data);

  if (chartData.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">ยังไม่มีข้อมูล</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        {/*
          isAnimationActive={false} — Finding 14 fix. Root cause: recharts'
          default mount animation eases the arc's endAngle in from 0, and
          for a single 100%-share slice that mid-animation state renders as
          a large missing wedge (a "Pac-Man" shape) instead of a loading
          shimmer, because there's only one slice to visually read as
          "still drawing". It self-corrects within ~1.5s, but any user or
          screenshot that lands during that window sees what looks like a
          broken chart. Disabling the mount animation makes the chart
          render its final, correct geometry immediately — this is a
          rendering/configuration fix only; the data transformation above
          (buildStatusPieChartData) and colors below are unchanged.
        */}
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={{ fill: colors.tick, fontSize: 11 }}
          isAnimationActive={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={colors.tooltipContentStyle}
          labelStyle={colors.tooltipLabelStyle}
          itemStyle={colors.tooltipItemStyle}
        />
        <Legend wrapperStyle={colors.legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

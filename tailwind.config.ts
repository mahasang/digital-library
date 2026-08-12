import type { Config } from "tailwindcss";

const shade = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `var(--${name}-${n})`])
  );

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Hallmark Audit Phase 5 — remaps Tailwind's stock gray/red/green/
        // amber/blue/purple scales onto the CSS variables in globals.css.
        // Every existing bg-gray-50, text-red-600, border-green-200, etc.
        // across every prior phase's code becomes theme-aware automatically
        // with zero component edits — see docs/theme-system.md. Light
        // values equal Tailwind's real defaults, so nothing changes in
        // light mode; only dark mode is new.
        gray: shade("gray"),
        red: shade("red"),
        green: shade("green"),
        amber: shade("amber"),
        blue: shade("blue"),
        purple: shade("purple"),
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdaff",
          300: "#8ec2ff",
          400: "#589fff",
          500: "#2f7dff",
          600: "#185ff2",
          700: "#134bd6",
          800: "#163fac",
          900: "#173987",
          950: "#112353",
        },
        // Design-foundation semantic tokens (Hallmark Audit Phase 0).
        // Backed by the CSS custom properties in app/globals.css so they
        // resolve to the correct value in both light and dark mode.
        // Purely additive — none of these names collide with Tailwind's
        // defaults or with the `brand` scale above, and no existing
        // utility class changes meaning.
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        "surface-translucent": "var(--color-surface-translucent)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        "ink-faint": "var(--color-ink-faint)",
        accent: "var(--color-accent)",
        "accent-strong": "var(--color-accent-strong)",
        "accent-soft": "var(--color-accent-soft)",
        "accent-soft-hover": "var(--color-accent-soft-hover)",
        "accent-ink": "var(--color-accent-ink)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        "focus-ring": "var(--color-focus-ring)",
      },
      fontFamily: {
        sans: [
          "var(--font-noto-thai)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      // New semantic type-scale keys, additive alongside Tailwind's
      // default text-xs..text-9xl scale (no existing text-* class
      // changes size). Values match the scale approved in the UI/UX
      // audit report.
      fontSize: {
        display: ["2.75rem", { lineHeight: "1.12", fontWeight: "600" }],
        h1: ["1.875rem", { lineHeight: "1.25", fontWeight: "600" }],
        h2: ["1.375rem", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "500" }],
      },
      // New elevation keys, additive alongside Tailwind's default
      // shadow-sm..shadow-2xl scale (no existing shadow-* class changes).
      boxShadow: {
        "elevated-sm": "var(--shadow-sm)",
        "elevated-md": "var(--shadow-md)",
      },
    },
  },
  plugins: [],
};

export default config;

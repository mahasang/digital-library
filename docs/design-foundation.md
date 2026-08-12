# Design Foundation (Hallmark Audit — Phase 0)

Status: **foundation only**. This phase formalizes design tokens and fixes
global keyboard-accessibility gaps. It does not redesign or restyle any
page — every screen renders exactly as it did before this change.

Background: this is Phase 0 of the phased redesign plan from the Hallmark
UI/UX audit. See that report for the full findings and the direction later
phases will move toward.

## What changed

- `app/globals.css` — new CSS custom properties (design tokens) on `:root`,
  a `prefers-color-scheme: dark` override block for those tokens, a global
  `:focus-visible` baseline, and a `.skip-link` component class.
- `tailwind.config.ts` — the same tokens exposed as Tailwind utility
  classes (`bg-surface`, `text-ink`, `text-h1`, `shadow-elevated-md`, etc.),
  added under `theme.extend` so nothing existing was overridden.
- `app/layout.tsx` — a skip-to-content link and an `id="main-content"` /
  `tabIndex={-1}` landmark on `<main>`.

Nothing else changed. No component's visual styling was touched, no route,
API, database, RLS policy, or auth behavior changed.

## Why current pages don't look different

`body`'s color and background in `globals.css` still use their original
hardcoded values (`#111827` / `#f9fafb`), unchanged. The new tokens exist
alongside them but nothing consumes them for existing page chrome yet —
only the two new elements this phase adds (the focus ring and the skip
link) read from the tokens. Migrating existing components to consume these
tokens for their own colors/spacing is later-phase work (see the audit's
phased plan), not part of this change.

## Token reference

### Color

CSS variable → Tailwind class. Every color has a light value (`:root`) and
a dark value (`@media (prefers-color-scheme: dark)`); nothing currently
switches the app into dark mode — these are the values a future dark-mode
toggle (Phase 5 of the redesign plan) will use.

| Token | Tailwind class | Light | Dark | Use for |
|---|---|---|---|---|
| `--color-background` | `bg-background` | `#f6f7fb` | `#0b1220` | Page background |
| `--color-surface` | `bg-surface` | `#ffffff` | `#111a2e` | Cards, panels |
| `--color-surface-muted` | `bg-surface-muted` | `#eef1f7` | `#172239` | Nested/inset surfaces |
| `--color-border` | `border-border` | `#dde2ec` | `#263252` | Default borders |
| `--color-border-strong` | `border-border-strong` | `#c7cee0` | `#34426a` | Emphasized borders |
| `--color-ink` | `text-ink` | `#14213d` | `#eef1f8` | Primary text |
| `--color-ink-soft` | `text-ink-soft` | `#55617a` | `#aab4cc` | Secondary text |
| `--color-ink-faint` | `text-ink-faint` | `#8892a6` | `#7986a6` | Tertiary/caption text |
| `--color-accent` | `text-accent` / `bg-accent` | `#185ff2` | `#5b9dff` | Primary actions, links — same as `brand-600` |
| `--color-accent-strong` | `text-accent-strong` | `#134bd6` | `#8fbeff` | Hover/pressed states — same as `brand-700` |
| `--color-accent-soft` | `bg-accent-soft` | `#eaf2ff` | `#16233d` | Accent-tinted backgrounds |
| `--color-success` / `warning` / `danger` / `info` | `text-success` etc. | see `globals.css` | see `globals.css` | Status pills, alerts |
| `--color-focus-ring` | `focus-ring` | `#185ff2` | `#5b9dff` | Keyboard focus outline only |

The existing `brand` scale (`brand-50` … `brand-950`) in `tailwind.config.ts`
is untouched — `accent` / `accent-strong` are semantic aliases for
`brand-600` / `brand-700`, not a replacement for them. Use whichever reads
more clearly at the call site.

### Typography

New Tailwind `fontSize` keys, additive alongside the default `text-xs`…
`text-9xl` scale (no existing `text-*` class changed size):

| Class | Size / line-height | Use for |
|---|---|---|
| `text-display` | 44px / 1.12, weight 600 | Hero-level headings only |
| `text-h1` | 30px / 1.25, weight 600 | Page titles |
| `text-h2` | 22px / 1.35, weight 600 | Section headings |
| `text-body` | 16px / 1.6 | Default body copy |
| `text-body-sm` | 14px / 1.55 | Secondary/metadata text |
| `text-caption` | 13px / 1.4, weight 500 | Labels, eyebrows |

The font family is unchanged: Noto Sans Thai remains the only typeface for
every size, including headings. No new typeface was added in this phase.

### Spacing

No config change. Tailwind's default spacing scale (`p-1`, `gap-4`, `mt-6`
etc., 4px increments) already matches the scale approved in the audit —
`p-4` = 16px, `gap-6` = 24px, `p-8` = 32px, and so on. Use the existing
scale as-is; there is no separate "design foundation" spacing utility.

### Border radius

No config change. Existing usage is already consistent and matches the
approved scale: `rounded` (4px) for tight inline elements, `rounded-lg`
(8px) for cards/buttons/inputs, `rounded-xl`/`rounded-2xl` (12–16px) for
dialogs and menus, `rounded-full` for pills and avatars. Keep using these
directly.

### Shadow

New Tailwind `boxShadow` keys, additive alongside the default `shadow-sm`…
`shadow-2xl` scale:

| Class | Use for |
|---|---|
| `shadow-elevated-sm` | Cards that need to read as slightly raised |
| `shadow-elevated-md` | Menus, popovers, modals |

Existing `shadow-lg` / `shadow-xl` usage (dialogs, dropdown menus) is
unchanged — these are additive options for later-phase work, not a
replacement.

## Focus ring

`app/globals.css` adds one global rule:

```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

This is a **fallback baseline**, not an override. It applies to every
focusable element — links, buttons, inputs, selects, textareas, dialogs,
menus, custom widgets — that doesn't already declare its own focus style.
Where a component already sets its own `focus-visible:outline-*` (e.g.
`components/ui/Button.tsx`) or `focus:ring-*` (most form inputs across the
app), those utility classes have higher CSS specificity than this bare
`:focus-visible` selector and continue to render exactly as before — this
phase does not change how any already-styled component looks on focus.

What this fixes: elements that previously had no visible focus indicator
at all — icon-only buttons (e.g. dialog close buttons), dropdown menu
items, and most plain links — now get a visible, high-contrast ring in
both light and dark color schemes.

New components should generally rely on this global default rather than
hand-rolling `focus-visible:outline-*` per component. If a component needs
a different treatment (e.g. an inset ring on a dark surface), reference
`var(--color-focus-ring)` / the `focus-ring` Tailwind color rather than a
hardcoded blue.

## Skip-to-content link

`app/layout.tsx` renders one link as the first element inside `<body>`:

```tsx
<a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหาหลัก</a>
```

styled by `.skip-link` in `globals.css` — visually hidden (`top: -100%`)
until it receives keyboard focus (`:focus-visible`), then it appears fixed
at the top-left of the viewport above all other content. It targets
`<main id="main-content" tabIndex={-1}>`, which every page already renders
through the shared root layout, so this works identically on every route
and at every breakpoint without any per-page change.

`tabIndex={-1}` makes `<main>` a valid programmatic focus target without
adding it to the normal Tab order. Its own focus outline is intentionally
suppressed (`outline-none` in the layout) since a visible ring around an
entire page-length landmark is not useful — the meaningful accessibility
event is the focus (and scroll) moving there, which happens regardless of
whether a ring is drawn around it.

## What's intentionally out of scope for Phase 0

- Restyling any existing page or component to consume the new color/type
  tokens.
- An actual dark-mode toggle — the dark token values exist and are ready,
  but nothing in the product switches into dark mode yet.
- Per-file cleanup of the ~30 form components that already pair
  `focus:outline-none` with `focus:ring-1` — that pattern already provides
  a visible indicator and was left as-is to avoid unrelated visual changes
  in this phase.
- A serif/display typeface for editorial headings (recommended in the
  audit's visual-direction section) — deferred to the phase that actually
  applies it, so this phase doesn't ship an unused font import.

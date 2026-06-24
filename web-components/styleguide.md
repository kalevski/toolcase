# @toolcase/web-components — Style Guide

The visual and architectural rules for every `tc-*` component. This is the
**product voice** of the toolcase design system: sharp corners, slate ink,
1px hairline borders, dense and businesslike. Read this before adding or
restyling a component.

---

## 1. Principles

1. **Neutrals carry the design.** The slate ramp does almost all the work;
   color is information (status), never decoration.
2. **Structure with hairlines, not boxes-in-boxes.** 1px borders and 1px-gap
   grids separate surfaces. Elevation is a whisper, reserved for overlays.
3. **Sharp by mandate.** `border-radius: 0` on every rectangle. The only
   sanctioned curves are genuinely circular/pill shapes: radio dots, spinner
   rings, switch tracks (`999px`), avatars (`50%`), the active carousel-dot
   pill (`3px`), and the 2px brand dot.
4. **Two type families, used with intent.** Inter for everything
   human-readable; JetBrains Mono for everything machine-facing — versions,
   breadcrumbs, page numbers, kbd hints, micro-labels, the brand wordmark.
   "Prose is Inter; structure is mono."
5. **Spend the accent like it's expensive.** The cyan accent appears on the
   brand dot, breadcrumb hover, focus, and almost nowhere else. Primary
   actions use slate ink, not color.
6. **Motion is fast and small.** Hovers lift one pixel; state changes ease in
   200ms. No bounce, no springs, no decorative loops.

---

## 2. Tokens

Two variable families, both defined at `:root` (and `tc-theme[name='default']`)
in `style/themes/default/_foundation.scss`:

- `--tc-*` — the toolcase design-system tokens (the source of truth).
- `--bs-*` — the Bootstrap 5.3-compatible variable contract. Component
  partials drive **all** styling through `--bs-<component>-*` custom
  properties so themes can re-skin via vars alone. Bootstrap itself is gone;
  the variable API survives as the public theming surface.

Compile-time Sass values (breakpoints, spacers, `$slate-*`, `$theme-colors`
maps) live in `style/foundation/_tokens.scss` and are imported per-partial via
`@use '../foundation/tokens' as *;`.

### Palette

| Token                              | Value                       | Use                                                               |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `--tc-slate-50…900`                | `#f8fafc` … `#0f172a`       | the neutral ramp everything is built on                           |
| `--tc-surface`                     | `#ffffff`                   | cards, menus, panels                                              |
| `--tc-surface-muted`               | slate-100                   | hover wells, addon fills                                          |
| `--tc-surface-hover`               | slate-50                    | row hover, rails                                                  |
| `--tc-border`                      | slate-200                   | default 1px hairline                                              |
| `--tc-border-strong`               | slate-300                   | form controls, grouped buttons, pagination                        |
| `--tc-text` / `-muted` / `-faint`  | slate-800 / 500 / 400       | text ladder                                                       |
| `--tc-ink` / `--tc-ink-2`          | dark oklch slate            | toasts, tooltips, dark navbar, code                               |
| `--tc-app-accent`                  | `#1e293b`                   | the "accent" of the product voice: primary buttons, active states |
| `--tc-accent`                      | cyan `oklch(0.58 0.16 235)` | the signature accent — brand dot, breadcrumb hover, highlights    |
| `--tc-success/info/warning/danger` | green/sky/amber/red         | status only                                                       |
| `--tc-*-bg`                        | soft tints                  | alert fills, outline-button hover washes                          |

### Type scale (component register)

- Body/default: `0.925rem`; buttons `0.925rem` w/ `letter-spacing: 0.025em`,
  weight 500.
- Dense UI text: `13px` (menu items, list groups, tabs, modal body, labels in
  catalogs); secondary dense: `12.5px`; meta/micro: `10–11.5px` mono.
- Headings cap at **600**. 700 is reserved for the brand wordmark and alert
  titles. Active/emphasis states use 500.
- Mono micro-labels: uppercase, `letter-spacing 0.05–0.12em` (dropdown
  headers, floated labels, table headers).

### Shadows

Three low, tight tiers + one hover lift. Surfaces are flat; borders do the
separating.

| Token               | Use                                                    |
| ------------------- | ------------------------------------------------------ |
| `--tc-shadow-sm`    | cards at rest                                          |
| `--tc-shadow-md`    | tooltips                                               |
| `--tc-shadow-lg`    | modals, dropdowns, popovers, toasts — the overlay tier |
| `--tc-shadow-hover` | card hover lift (with `translateY(-1px)`)              |

### Motion

- `--tc-transition-fast` = `0.15s ease` — hovers, color shifts.
- `--tc-transition-base` = `0.2s cubic-bezier(0.4, 0, 0.2, 1)` — state
  changes (switch slide, collapse, card lift).
- Everything respects `prefers-reduced-motion` (global block in
  `foundation/_reset.scss`; spinners slow rather than vanish).

### Z-index (fixed scale — never add layers)

`tooltip 1070 > dropdown 1060 > modal 1055 > backdrop 1050 > sticky 1020`,
all exposed as `--tc-z-*`.

### Focus

- Keyboard: global `:focus-visible { outline: 2px solid var(--tc-app-accent); outline-offset: 2px }`.
- Form controls: border `rgba(30,41,59,0.5)` + ring
  `0 0 0 0.2rem rgba(30,41,59,0.12)` on `:focus` (the `--tc-focus-ring`
  family). Never remove focus visibility.
- Touch targets ≥ 44px under `@media (pointer: coarse)`.

---

## 3. Component patterns (the recognisable motifs)

- **Primary button** — the signature 135° slate-ink gradient
  (`linear-gradient(135deg, var(--tc-app-accent), #2b3a51)`); hover =
  `translateY(-1px)` + `0 4px 15px rgba(30,41,59,0.3)` glow. Solid variants
  never darken on hover — the lift _is_ the feedback. Outline-primary uses a
  neutral border-strong hairline; colored outlines wash in their soft `-bg`
  tint on hover, never flip solid.
- **Active = solid ink.** Selected segments, pills, pagination pages,
  list-group items, dropdown actives: `--tc-app-accent` fill, white text.
- **Hover = slate well.** Menu items, icon buttons, close buttons hover to
  `--tc-surface-muted` (slate-100), not a color.
- **Tabs/underline navs** — a 2px ink underline is the _only_ chrome. No
  boxes, no fills, no radius. Vertical underline navs move the marker to the
  left edge (the scrollspy side-rail pattern).
- **Alert** — no outer border; a 4px colored left border + 135° tint gradient
  (`0.1 → 0.04`) + the variant's dark emphasis text.
- **Card** — white, 1px hairline, `shadow-sm`; header cap wears a faint ink
  gradient (`rgba(30,41,59,0.03) → 0.01`). Solid (`text-bg-*`) cards resolve
  body/cap color via `currentcolor` (never `inherit` inside a custom
  property — CSS-wide keywords don't forward).
- **Toast & tooltip live on ink.** `--tc-ink` surface, white text,
  `shadow-lg`/`-md`; toast status is a 3px colored left stripe, never a
  colored fill.
- **Grouped controls collapse borders.** Button groups, pagination, input
  groups: one border-strong frame, 1px internal separators, no double borders.
- **Inner separators are fainter than outer frames.** List groups and
  accordions: outer `--tc-border` box, slate-100 hairlines inside.
- **Switch** — pill track, pure-circle knob (never a check glyph); checked
  track carries the signature ink gradient.
- **Spinners** — currentcolor-driven (`text-{variant}` sets the hue): ring
  w/ slate-200 track, grow, dots trio, sharp equalizer bars, sonar pulse,
  dashed orbit. Circles are sanctioned; bars stay sharp.
- **Navbar** — the app chrome: translucent glass (`rgba(255,255,255,0.85)` +
  `backdrop-filter: saturate(1.2) blur(6px)`), hairline bottom, mono brand
  wordmark with the 12px cyan square dot, 2px accent underline on the active
  link. Dark variant sits on `--tc-ink`.
- **Breadcrumbs are mono** (12px, faint), links hover to the cyan accent —
  one of its few appearances.

---

## 4. Icons

**lucide-static** (ISC) is the icon dependency. Icons render as **inline
SVG** (`stroke="currentColor"`), injected through `src/icons.ts` (`icon()`
helper strips fixed sizing; CSS owns the dimensions). Never use CSS
`background-image` data-URIs for glyphs that must survive foreign stylesheets
or recolor with state — that's how the close button went invisible. The
toggler hamburger and form-check glyphs (radio dot, check, switch knob) are
the grandfathered data-URI exceptions; they live inside `--bs-*` custom
properties so themes can replace them.

No emoji as icons. No unicode-as-icon beyond the dropdown caret triangle.

---

## 5. Architecture & conventions

```
style/
  index.scss                 foundation → components → themes/default
  foundation/                Sass tokens · reset · grid · utilities
  components/_<name>.scss    one partial per component, all values via --bs-*
  themes/default/            runtime tokens (:root) — the design skin
src/
  <Name>.ts                  one custom element per file, light DOM
  icons.ts                   lucide imports + helper
```

- **Light DOM, global stylesheet.** Components render Bootstrap-compatible
  classnames into their light DOM; `style.css` paints them. No shadow roots.
- **Custom-element hosts need explicit `display`** — register new tags in the
  block/inline-block lists in `foundation/_reset.scss` (unstyled custom
  elements default to `display: inline`; this has broken layout before —
  see `tc-dropdown-item`).
- **Keep the `--bs-<component>-*` names.** They're the public theming
  contract. Restyle by changing values; add new props with the same prefix
  when a knob is missing.
- **px ↔ rem**: visual equality wins; prefer the unit already used in the
  partial (`13px` ≡ `0.8125rem`).
- **4-space indentation, prettier-formatted.** Comment the _why_ (a
  constraint, a cascade trick), not the what.
- **New component = four touchpoints**: `src/<Name>.ts` + registration in
  `src/register.ts`, `style/components/_<name>.scss` + `_index.scss` forward,
  a demo in `examples/src/web-components/`, and an entry in
  `examples/public/web-components/SKILL.md`.

### Defensive cascade (foreign Bootstrap builds)

Consumers (including the examples site) may load other Bootstrap-derived
stylesheets that share these classnames. Rules of engagement:

- Zero out everything a motif doesn't use — explicit `border: 0`,
  `border-radius: 0`, `background: none` on tabs/underline links beats a
  foreign full-border rule at equal specificity because this sheet loads
  later. Don't rely on "we never set it".
- Watch bare `:focus` rules in foreign sheets (re-neutralise, then re-enable
  via `:hover` / `:focus-visible` / `.active` at the same specificity, later
  in the file).
- Pin weights where foreign sheets push beyond the 500/600 cap.
- Prefer inline SVG over background-image glyphs (see Icons).
- `!important` is a last resort, allowed only against utility classes that
  themselves use it (e.g. `.text-bg-*`).

---

## 6. Accessibility rails

- Focus is always visible (outline for keyboard, ring for form controls).
- Disabled = `opacity` + `pointer-events: none`, never color-only.
- Spinners/close buttons carry `role="status"` / `aria-label`; visually
  hidden labels via `.visually-hidden`.
- 44px touch targets under coarse pointers; carousel dots extend their hit
  area with an invisible `::after` inset.
- Contrast: solid fills use white text except `light` (slate-900); soft
  tinted surfaces pair with the variant's dark emphasis color.
- Honour `prefers-reduced-motion` for every animation you add.

---

## 7. Quick checklist for a new/changed component

- [ ] Sharp corners (radius only on sanctioned circles/pills)?
- [ ] All cosmetics flow through `--bs-<component>-*` custom properties?
- [ ] Slate ladder + ink accent; cyan only if it's genuinely a highlight?
- [ ] Mono for machine-facing text?
- [ ] Hairline borders; shadows only at the overlay tier?
- [ ] Hover well / ink active / 1px lift — the standard state ladder?
- [ ] Focus visible, disabled states, reduced motion, 44px coarse targets?
- [ ] Survives a foreign Bootstrap sheet loading first?
- [ ] Demo + SKILL.md updated?

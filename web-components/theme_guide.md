# Building a `@toolcase/web-components` theme

A practical playbook for authoring a new opt-in `tc-*` theme, distilled from the
**blueprint** build (`style/themes/blueprint/`). Read this end-to-end before you
start; it captures the architecture, the exact build order, and the traps that
cost real time.

---

## 1. Mental model — themes are token-driven

Every `tc-*` component paints itself through **`--bs-<component>-*`** custom
properties (Bootstrap 5.3 names) whose **defaults resolve to `--tc-*` design
tokens** (e.g. `--bs-panel-bg: var(--tc-surface)`). You almost never restyle a
component directly. Instead a theme:

1. Declares its own **palette tokens** (a private prefix, e.g. `--bp-*` for
   blueprint, `--ah-*` for aurora).
2. **Remaps the `--tc-*` tokens** onto that palette.
3. Sets the **`--bs-*` Bootstrap-compatible contract** (`--bs-primary`,
   `--bs-body-bg`, `--bs-border-radius`, …).

Because every component's `--bs-*-*` defaults flow through `--tc-*`, **that one
remap re-skins the entire library**. Per-component partials only add the
*structure* a flat token swap can't carry (gradients, glows, brackets, the type
voice, contrast fixes, replacing hardcoded literals).

A theme is **scoped and inert until opted into**. The root selector is always:

```scss
tc-theme[name='<name>'],
[data-tc-theme='<name>'] { … }
```

Nothing leaks to global scope. `<tc-theme name="x">…</tc-theme>` (custom element)
and `<div data-tc-theme="x">…</div>` (plain wrapper, what the examples site uses)
both activate it.

### Reference themes
- `default` — the product voice, applied at `:root` (no wrapper). The contract
  every token must fill.
- `dungeon` — fantasy skin (gilded bronze / parchment / ink).
- `aurora` — **the model full dark skin**: own palette → `--tc-*` remap → `--bs-*`
  + ~24 component partials. Copy its structure.
- `sunshine` — warm light skin; demonstrates **generated radius + border sweeps**.
- `neon` — dark synthwave; dual neon accents, glow text.
- `blueprint` — light skin with bright multi-hue accents and (uniquely) **rounded
  corners**; demonstrates the per-component redesign + radius sweep.

---

## 2. Anatomy of a theme

```
style/themes/<name>/
  _foundation.scss          # palette tokens + --tc-* remap + --bs-* contract
  _index.scss               # @use 'foundation'; @use 'components';
  components/
    _index.scss             # @use every partial; @use './radius' LAST
    _button.scss            # structural override partials …
    _card.scss
    …
    _radius.scss            # (optional) GENERATED corner sweep — load last
```

Wire it into the global stylesheet once:

```scss
// style/index.scss — append after the other themes
@use './themes/<name>';
```

Load order matters: `foundation` (the remap) must come **before** the component
partials so they override on top of already-themed tokens; the **radius/structure
sweep loads last** so its re-points win over any flat literal.

---

## 3. Step 0 — write a spec first

Before any SCSS, capture the design in a markdown spec (see
`blueprint_theme.md` as the gold-standard example). It pays for itself: every
later step copy-pastes from it. Capture, with exact values:

- **Palette** — canvas/surfaces, ink/text ramp, accent set (+ hover + on-fill ink
  + soft fill), hairlines, semantic success/info/warning/danger.
- **Typography** — families (display / body / mono), the type scale (size /
  weight / tracking / transform per element).
- **Radii** — the scale (or "sharp, 0" if following the mandate).
- **Shadows** — resting / hover / glow recipes.
- **Component recipes** — the bespoke treatments (e.g. a card's corner bracket, a
  pricing "popular" ribbon, a backdrop grid).
- **A `--tc-*` remap table** and a **`--bs-*` contract block**, ready to paste.
- **Cautions** — which mandates you're keeping vs breaking, and why.

---

## 4. Step 1 — `_foundation.scss` (the heavy lifter)

This single file does ~90% of the work. Three blocks, in order, inside the theme
root selector. Template (abridged from blueprint):

```scss
@use '../../foundation/tokens' as *;

tc-theme[name='blueprint'],
[data-tc-theme='blueprint'] {
    color-scheme: light;                 // or dark
    color: var(--bp-text);               // inherits through display:contents
    font-family: var(--bp-body);

    // ── (a) Private palette tokens — your design system's source of truth ───
    --bp-bg: #eef1f8;
    --bp-paper: #ffffff;
    --bp-text: #1a1830;
    --bp-pink: #e01172;  --bp-pink-hover: #f5237f;  --bp-pink-ink: #fff;
    --bp-teal: #0aa89a;  --bp-teal-fg: #097f74;     // darker for TEXT on light
    /* …borders, soft fills, fonts, radii, shadow recipes, gradients… */

    // ── (b) Remap --tc-* onto the palette — re-skins ALL components ─────────
    --tc-font-sans: var(--bp-body);
    --tc-font-mono: var(--bp-mono);
    --tc-surface: var(--bp-paper);
    --tc-border: var(--bp-border);
    --tc-text: var(--bp-text);
    --tc-text-muted: var(--bp-text-muted);
    --tc-text-inverse: #ffffff;          // text on dark/ink surfaces — see traps
    --tc-app-accent: var(--bp-pink);     // PRIMARY actions / links
    --tc-app-accent-contrast: var(--bp-pink-ink);
    --tc-app-accent-gradient: var(--bp-pink-grad);   // see "slate-stop" trap
    --tc-accent: var(--bp-teal);         // highlights / focus / brand dot
    --tc-accent-fg: var(--bp-teal-fg);   // darkened so accent TEXT clears AA
    --tc-success: var(--bp-teal);  --tc-info: var(--bp-violet);
    --tc-warning: var(--bp-amber); --tc-danger: #dc2626;   // keep a real red
    --tc-shadow-sm: …; --tc-shadow-md: …; --tc-shadow-lg: …; --tc-shadow-hover: …;
    --tc-focus-ring: 0 0 0 0.2rem rgba(224,17,114,.20);

    // ── (c) Bootstrap-compatible contract --bs-* ────────────────────────────
    --bs-primary: var(--bp-pink);  --bs-primary-rgb: 224,17,114;
    --bs-success: var(--bp-teal);  --bs-success-rgb: 10,168,154;
    --bs-danger: #dc2626;          --bs-danger-rgb: 220,38,38;
    --bs-body-bg: var(--bp-bg);    --bs-body-bg-rgb: 238,241,248;
    --bs-body-color: var(--bp-text);
    --bs-border-color: var(--bp-border);
    --bs-border-radius: var(--bp-r-md);  // sharp themes use 0
    --bs-link-color: var(--bp-pink);
    --bs-focus-ring-color: rgba(224,17,114,.20);
}
```

> `tc-theme` is `display:contents` (paints no box). `color` / `font-family` /
> custom properties inherit to descendants, but a **`background` will not paint** —
> for a canvas/backdrop, theme `tc-artboard-backdrop` (a real box), not the root.

---

## 5. Step 2 — wire it up

```scss
// style/themes/<name>/_index.scss
@use 'foundation';
@use 'components';
```

```scss
// style/themes/<name>/components/_index.scss
@use './button';
@use './card';
/* … one @use per partial … */
@use './radius';   // GENERATED sweep — keep LAST
```

```scss
// style/index.scss — register the theme (inert until opted into)
@use './themes/<name>';
```

If you'll generate a radius/structure sweep later, drop a **stub** `_radius.scss`
(header comment only) so the first build compiles before generation.

---

## 6. Step 3 — core identity partials

Author the cross-cutting partials that express the theme's identity — the things
a token swap can't carry. **Model the set on `aurora/components/`** (~15–24
files). The high-value ones, by frequency:

| Partial | Adds |
|---|---|
| `_button.scss` | primary gradient + glow + hover lift; outline/secondary hover hues |
| `_card.scss` | surface gradient/shadow, hover lift/border, any corner bracket |
| `_panel.scss` | framed surface + header voice |
| `_eyebrow.scss` | the mono micro-label (often a leading dot) |
| `_heading.scss` / `_title.scss` | the display typeface + tracking |
| `_brand.scss` | wordmark face + accent underline |
| `_navbar.scss` | the bar fill (a hardcoded light glass the remap can't reach) |
| `_artboard-backdrop.scss` | the canvas — grid / glow / gradient field |
| `_input.scss` | focus ring/border, label colour, checkbox/radio glyphs |
| `_link.scss` | status-variant link hues |
| `_code-snippet.scss` | dark code surface + syntax token hexes |
| `_pulse-indicator.scss` / `_status-dot.scss` | live dot glow |

Partial template — drive via the component's own `--bs-*-*` vars first; fall back
to element/class rules only for things with no var (a `::before`, an inline
literal):

```scss
// <name> › tc-card — one-line description of what this adds.
tc-theme[name='<name>'],
[data-tc-theme='<name>'] {
    .card {
        --bs-card-bg: var(--xx-surface);
        --bs-card-border-color: var(--xx-border);
        box-shadow: var(--tc-shadow-sm);
    }
    .card:hover { transform: translateY(-3px); border-color: var(--xx-accent); }
}
```

---

## 7. Step 4 — build (mind the Node version)

```bash
npm -w @toolcase/web-components run build:css      # sass → lib/index.css
```

> **The build needs Node ≥ 22.5.** Under Node 18 the sass CLI dies with
> `ERR_REQUIRE_ESM` (chokidar). If you hit that:
> `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"` (or `nvm use 22`).

A clean `build:css` **is** the SCSS validation — there's no separate SCSS lint.
The examples site resolves the *stylesheet* from built `lib/index.css` (not src),
so rebuild after any SCSS edit for it to show.

---

## 8. Step 5 — structure sweeps (only if you break a mandate)

The toolcase mandate is **sharp corners** (`border-radius: 0`, circles via `50%`).
The base partials hardcode `border-radius: 0` on ~280 surfaces, so if your theme
wants rounded corners, a root `--bs-border-radius` override **cannot reach them**.
Solution: a generated sweep (blueprint and sunshine both do this).

`scripts/gen-blueprint-radius.mjs` reads the **compiled** `lib/index.css`, finds
every flat-cornered surface, and emits `components/_radius.scss` scoped to the
theme — LG tier (8px) for big framed containers, MD tier (5px) for controls,
preserving circles/pills and header/footer sub-parts. Build order:

```bash
npm -w @toolcase/web-components run build:css      # 1. emit CSS to scan
node scripts/gen-blueprint-radius.mjs              # 2. generate the sweep
npm -w @toolcase/web-components run build:css      # 3. re-emit with the sweep
```

`_radius.scss` is **GENERATED — never hand-edit**; tune the tiers in the script
and regenerate. The same pattern fits any structural property a flat swap misses
(see sunshine's border sweep, `gen-sunshine-border.mjs`).

---

## 9. Step 6 — per-component redesign (full custom skins)

For a fully bespoke skin you can give **every** component its own partial
(`components/_<name>.scss`) that restyles it to the theme. This is large
(~300+ components); fan it out with one agent per component. Hard-won rules:

- **Each agent writes only its own `_<name>.scss`.** Do **not** let agents edit
  the shared `components/_index.scss` — concurrent edits corrupt it. Instead,
  after the run, **regenerate `_index.scss` from the files on disk** (glob the
  partials, sort, emit `@use` lines, append `@use './radius'` last).
- Hand-author the cross-cutting core partials yourself first (Step 3) and
  **exclude those component names** from the fan-out so it can't clobber them.
- Give every agent the palette cheat-sheet, the theme scope, and explicit
  "don'ts" (below). Pure layout primitives (col/row/grid/spacer/stack/…) get a
  header-only partial — no cosmetics.
- Expect a few agents to fail mid-stream (transient API errors); re-list the
  missing files afterward and author those by hand or re-run just them.
- **Build after assembly and fix any SCSS errors**, then run the radius sweep
  once more (new partials may introduce flat surfaces).

---

## 10. Step 7 — make it selectable in the demo

```ts
// examples/src/App.tsx — add to routeThemes['web-components']
{ value: '<name>', label: '<Label>' },
```

The switcher wraps demos in `<div data-tc-theme={theme}>`, so the theme activates
immediately against the built `lib/index.css`.

---

## 11. Traps (these cost time)

- **The `#2b3a51` slate-stop gradient.** A family of CTAs fill with
  `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)`. The slate stop
  survives the remap → your accent renders accent→muddy-slate. Most consume
  `--tc-app-accent-gradient` (repoint it once in the remap and they fix for
  free); a few (`team-list`, `interact-prompt`, `benchmark-chart`) bake the
  literal and need a per-component override.
- **Slate-token leak.** Raw `var(--tc-slate-*)` refs inherit the *light* slate
  ramp (no theme remaps it). Route separators → `--tc-border-faint`, tracks →
  `--tc-border`; never leave bare slate refs.
- **Bright-accent contrast.** On-fill text: white on a bright accent fill may
  fail (mint, lemon) — flip the label to dark ink; or stay legible (pink, teal) —
  keep white. Accent-coloured **text** on a light canvas usually needs a
  *darkened* tone (`--tc-accent-fg`, e.g. teal `#097f74`) to clear AA. Decouple
  link colour from the app-accent where the base assumes a dark slate ink.
- **`--tc-text-inverse` is "text on a dark/ink surface"** (code blocks, footers,
  tooltips) — keep it **light** even on a light theme, or those go dark-on-dark.
- **No display-font token.** The contract has only `--tc-font-sans` / `-mono`.
  Headings that want a display face need a per-component partial
  (`.tc-title`/`.tc-heading { font-family: … }`) — there's no `--tc-font-display`.
- **Baked light pastels / dark inks.** Some components hardcode pastel fills
  (`#dcfce7`, `#fee2e2`) or `$theme-colors-emphasis` text that bypass the rgb
  remap. Only fix them when the pairing actually clashes in your theme.
- **Don't force UPPERCASE theme-wide on headings.** It mangles arbitrary app
  copy. Apply the display face + tracking; leave case alone.
- **Fonts aren't bundled.** Load display/body faces on the host page; always
  provide a system fallback in the font stack.
- **Honour `prefers-reduced-motion`** for any looping animation (marquee, grid
  scroll, pulse).

---

## 12. Cheat sheet

```bash
# Build (Node ≥22.5)
npm -w @toolcase/web-components run build:css

# Rounded/structure sweep (build → generate → rebuild)
npm -w @toolcase/web-components run build:css
node scripts/gen-blueprint-radius.mjs
npm -w @toolcase/web-components run build:css

# Full build + export-map lint (before bumping versions)
npm -w @toolcase/web-components run build
npm run lint:exports
```

### Done-when checklist
- [ ] Spec doc written (palette / type / radii / shadows / recipes).
- [ ] `_foundation.scss`: palette → `--tc-*` remap → `--bs-*` contract.
- [ ] `_index.scss` + `components/_index.scss` (radius last).
- [ ] Registered in `style/index.scss`.
- [ ] Core identity partials authored (modelled on aurora).
- [ ] `build:css` clean on Node 22.
- [ ] Radius/structure sweep generated + rebuilt (if you broke the mandate).
- [ ] Slate-token, slate-gradient, bright-accent, `text-inverse` traps checked.
- [ ] Added to the examples theme switcher.
- [ ] Looping motion gated behind `prefers-reduced-motion`.
```

# Vector Blueprint — theme style guide

Detailed spec of the **VECTOR BLUEPRINT (light)** landing design — option `2b` in
`template/WebGame Cloud Landing.dc.html` (lines 188–339). This document captures every
color, radius, type rule, shadow, and component recipe so the design can be ported into a
`@toolcase/web-components` theme (`style/themes/blueprint/`) that looks and behaves like the
template.

Aesthetic in one line: a **light, technical "blueprint" canvas** — cool lavender-grey paper
ruled with a faint violet grid, white cards with thin lilac hairlines, HUD corner-brackets and
mono micro-labels, painted with a 4-color arcade accent set (pink · teal · violet · amber),
soft long shadows, and **rounded corners** (3–14px).

---

## 0. How this plugs into web-components

The library themes are token-driven. Each component drives its cosmetics through
`--bs-<component>-*` custom properties whose defaults resolve to `--tc-*` design tokens. A
theme re-skins everything by:

1. Declaring its own palette tokens (here proposed as `--bp-*`).
2. Remapping the `--tc-*` tokens onto that palette.
3. Setting the `--bs-*` Bootstrap-compatible contract.
4. (Optional) Per-component partials in `components/` for structure a flat token swap can't
   carry (corner brackets, blueprint grid field, gradient cards).

Reference patterns: `style/themes/default/_foundation.scss` (the contract every token must
fill) and `style/themes/aurora/_foundation.scss` (a full non-default skin: own palette →
`--tc-*` remap → `--bs-*`). Blueprint is a **light** theme like default, but with a bright,
multi-hue accent set like aurora — so it inherits aurora's bright-accent cautions (see §13).

The theme root selector should follow the established convention:
`tc-theme[name='blueprint'], [data-tc-theme='blueprint']`.

---

## 1. ⚠ Critical divergence — border-radius

The toolcase mandate (`styleguide.md`, default + aurora + dungeon themes) is **sharp corners**:
`--bs-border-radius: 0`, radius only `50%` for circles. **The blueprint design breaks this on
purpose** — it is built on soft rounded rectangles (3–14px). The user explicitly asked for "the
same border-radius."

So the blueprint theme **must override `--bs-border-radius`** and any component partials that
hard-code `border-radius: 0`. This is the one rail the blueprint theme deliberately does not
follow. Treat it as a theme-level decision, documented here, not an accident. Radius scale in §5.

---

## 2. Color palette

### 2.1 Canvas & ambient

| Role | Value | Notes |
|---|---|---|
| Page background | `#eef1f8` | cool light lavender-grey "paper" |
| Blueprint grid lines | `rgba(91,61,242,.06)` | violet, `38px × 38px` grid, both axes |
| Ambient glow — top-right | `rgba(224,17,114,.05)` | pink radial, `ellipse at 70% 12%`, fades by 55% |
| Ambient glow — bottom-left | `rgba(10,168,154,.06)` | teal radial, `ellipse at 12% 70%`, fades by 55% |

### 2.2 Ink / text ramp

| Token role | Value | Used for |
|---|---|---|
| Text (primary ink) | `#1a1830` | headings, body emphasis, dark list items |
| Text muted | `#5d5887` | nav links, paragraphs, card descriptions |
| Text faint | `#8e89b3` | `.CLOUD` suffix, footer micro-copy, `/mo`, faint labels |
| List ink (soft) | `#3c3960` | pricing list items (non-emphasis plans) |

### 2.3 Accent set (4 arcade hues)

| Hue | Base | Hover | Soft fill | Role |
|---|---|---|---|---|
| **Pink / magenta** | `#e01172` | `#f5237f` | `rgba(224,17,114,.06–.12)` | **Primary CTA**, "popular" plan, P-03 Builds, P-04 Live Configs |
| **Teal** | `#0aa89a` | `#0bbcab` | `rgba(10,168,154,.06–.12)` | Secondary action ("OPEN CONSOLE"), P-01 Projects, P-06 tools, CTA highlight, INDIE plan |
| **Violet / indigo** | `#5b3df2` | — | `rgba(91,61,242,.10)` | Grid lines, "backend." word, P-02 Files, STUDIO plan |
| **Amber** | `#d98a14` | — | — | P-05 Team, normal-maps tag, HUD bundle count (dark variant uses `#ffb13d`) |

Per-element accent **rotation** (the signature move — each feature card / chip / plan owns one
hue): see §11.

### 2.4 Borders / hairlines

| Role | Value |
|---|---|
| Card border (default) | `#e3e0f2` |
| Strong border (art panel, CTA box) | `#d4d0ea` |
| Secondary-button border | `#c5c1e0` |
| Panel header divider | `#e9e6f6` |
| Ticker top/bottom rule | `#d9d5ee` |
| Tool-tag / chip border | `#d8d4ec` |
| Pink soft-card border (P-04) | `#f3bcd4` |
| Popular-plan border | `#e01172` (1.5px) |

All hairlines are **1px** except the popular plan (`1.5px`) and HUD corner-brackets (`2px`).

### 2.5 Surfaces & gradients

| Role | Value |
|---|---|
| Card / panel surface | `#fff` |
| Art-frame inner | `linear-gradient(180deg, #fbfaff, #f1eefb)` |
| Pink spotlight card (P-04) | `linear-gradient(135deg, #fde4ee, #fff)` |
| CTA panel | `linear-gradient(135deg, #fff, #f3eefc)` |
| Popular plan | `#fff` (flat white + pink border + pink glow shadow) |
| Ticker strip | `rgba(255,255,255,.5)` |
| Eyebrow soft fill | `rgba(10,168,154,.06)` (teal) |

### 2.6 Semantic mapping (for `--tc-success/info/warning/danger`)

The design has no explicit success/danger system, so map the arcade hues:

| Semantic | Suggested | Soft bg |
|---|---|---|
| primary / accent | pink `#e01172` | `rgba(224,17,114,.10)` |
| success | teal `#0aa89a` | `rgba(10,168,154,.12)` |
| info | violet `#5b3df2` | `rgba(91,61,242,.10)` |
| warning | amber `#d98a14` | `rgba(217,138,20,.14)` |
| danger | keep a true red, e.g. `#dc2626` | `#fee2e2` — pink reads as brand, not error |

> Caution: keep `danger` a real red. Reusing pink for danger collides with the primary CTA.

---

## 3. Proposed blueprint palette tokens (`--bp-*`)

Declare these on the theme root, then remap `--tc-*` onto them (§12). Mirrors aurora's `--ah-*`
approach.

```scss
// Canvas
--bp-bg:            #eef1f8;
--bp-paper:         #ffffff;        // cards/panels
--bp-paper-tint:    #fbfaff;        // art-frame top
--bp-paper-tint-2:  #f1eefb;        // art-frame bottom
--bp-cta-grad:      linear-gradient(135deg, #ffffff, #f3eefc);

// Ink / text
--bp-text:          #1a1830;
--bp-text-muted:    #5d5887;
--bp-text-faint:    #8e89b3;
--bp-text-soft:     #3c3960;

// Accents
--bp-pink:          #e01172;  --bp-pink-hover:  #f5237f;
--bp-teal:          #0aa89a;  --bp-teal-hover:  #0bbcab;
--bp-violet:        #5b3df2;
--bp-amber:         #d98a14;

// Soft accent fills
--bp-pink-soft:     rgba(224,17,114,.10);
--bp-teal-soft:     rgba(10,168,154,.06);
--bp-violet-soft:   rgba(91,61,242,.10);
--bp-amber-soft:    rgba(217,138,20,.14);

// Borders
--bp-border:        #e3e0f2;
--bp-border-strong: #d4d0ea;
--bp-border-soft:   #c5c1e0;   // secondary buttons
--bp-border-faint:  #e9e6f6;   // dividers
--bp-border-rule:   #d9d5ee;   // ticker rules
--bp-border-chip:   #d8d4ec;   // tool chips
--bp-border-pink:   #f3bcd4;   // pink spotlight card

// Grid + ambient
--bp-grid-line:     rgba(91,61,242,.06);
--bp-glow-field:
    radial-gradient(ellipse at 70% 12%, rgba(224,17,114,.05), transparent 55%),
    radial-gradient(ellipse at 12% 70%, rgba(10,168,154,.06), transparent 55%);
--bp-grid-field:
    linear-gradient(var(--bp-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--bp-grid-line) 1px, transparent 1px);
--bp-grid-size:     38px 38px;
```

---

## 4. Typography

Three families, all from Google Fonts (loaded on host page; the template preconnects + loads
them). Fall back to system sans / monospace.

```
Space Grotesk   — body / UI sans (400 500 600 700)
Chakra Petch    — DISPLAY: headings, brand, card titles, prices, buttons (500 600 700)
JetBrains Mono  — structure: eyebrows, micro-labels, nav links, badges, ticker, HUD (400 500 700)
```

> Loaded by the template but **unused in 2b**: Bricolage Grotesque, Plus Jakarta Sans, Syne. Skip them.

### 4.1 Type scale

| Element | Family | Size | Weight | Tracking | Transform | Line-height |
|---|---|---|---|---|---|---|
| Hero h1 | Chakra Petch | 64px | 700 | -.01em | UPPERCASE | .98 |
| Section h2 | Chakra Petch | 40px | 700 | -.01em | UPPERCASE | (normal) |
| CTA h2 | Chakra Petch | 46px | 700 | -.01em | UPPERCASE | 1.04 |
| Card title | Chakra Petch | 19px | 600 | — | none | (normal) |
| Spotlight (P-04) title | Chakra Petch | 24px | 700 | — | none | — |
| Price number | Chakra Petch | 42px | 700 | — | none | — |
| Price `/mo` suffix | Space Grotesk | 15px | 500 | — | — | — |
| Brand wordmark | Chakra Petch | 19px | 700 | .02em | none | — |
| Hero paragraph | Space Grotesk | 18px | 400 | — | none | 1.55 |
| Section intro | Space Grotesk | 17px | 400 | — | — | — |
| Card body | Space Grotesk | 14px | 400 | — | — | 1.55 |
| Eyebrow pill | JetBrains Mono | 11px | 600 | **.18em** | UPPERCASE | — |
| Micro-label (`P-01 · …`) | JetBrains Mono | 12px | 700 | .06em | UPPERCASE | — |
| Nav link | JetBrains Mono | 13px | 500 | .04em | UPPERCASE | — |
| Nav CTA / buttons | Chakra Petch | 14–15px | 700 | .02em | UPPERCASE | — |
| Tool chip | JetBrains Mono | 13px | 600 | — | UPPERCASE | — |
| Stat ticker | JetBrains Mono | 13px | 600 | .1em | UPPERCASE | — |
| Badge (`2b`) | JetBrains Mono | 11px | 700 | — | — | — |
| Footer micro-copy | JetBrains Mono | 11px | 500 | .08–.1em | UPPERCASE | — |
| Panel header / HUD | JetBrains Mono | 10px | 600 | .08em | UPPERCASE | 1.6 |

Pattern to internalize: **Chakra Petch = display (uppercase, tight tracking)**, **JetBrains Mono
= every label/eyebrow/status (uppercase, loose tracking)**, **Space Grotesk = prose**. Headings
are uppercase; body is sentence case.

---

## 5. Border-radius scale

Rounded, soft. (Overrides the toolcase sharp mandate — see §1.)

| Token | Value | Applied to |
|---|---|---|
| `--bp-r-xs` | `3px` | eyebrow pill |
| `--bp-r-sm` | `4px` | nav button, popular ribbon badge |
| `--bp-r-md` | `5px` | buttons, tool chips |
| `--bp-r-lg` | `8px` | feature cards, tools panel |
| `--bp-r-xl` | `10px` | art frame, pricing cards |
| `--bp-r-2xl` | `14px` | CTA panel |
| circle | `50%` | status dots, brand polygon fill |

Suggested `--bs-border-radius: var(--bp-r-md)` (5px) as the default component radius; map larger
surfaces (cards/modals/panels) to 8–10px via their `--bs-<component>-border-radius`.

---

## 6. Shadows

Soft, long, low-opacity, tinted with the dark-violet ink `rgba(40,30,90, …)`. Accent CTAs get a
colored glow.

| Role | Value |
|---|---|
| Card (resting) | `0 2px 10px rgba(40,30,90,.05)` |
| Card (pricing) | `0 2px 12px rgba(40,30,90,.05)` |
| Art frame | `0 24px 50px rgba(40,30,90,.14)` |
| CTA panel | `0 14px 40px rgba(40,30,90,.1)` |
| Popular plan | `0 12px 34px rgba(224,17,114,.18)` (pink glow) |
| Pink CTA button | `0 6px 20px rgba(224,17,114,.3)` |
| Pink button (pricing) | `0 6px 18px rgba(224,17,114,.3)` |
| Teal nav button | `0 4px 14px rgba(10,168,154,.32)` |

Token suggestion:

```scss
--bp-shadow-sm:   0 2px 10px rgba(40,30,90,.05);
--bp-shadow-md:   0 12px 34px rgba(40,30,90,.10);
--bp-shadow-lg:   0 24px 50px rgba(40,30,90,.14);
--bp-glow-pink:   0 6px 20px rgba(224,17,114,.3);
--bp-glow-teal:   0 4px 14px rgba(10,168,154,.32);
```

---

## 7. Background & ambient effects

The page is a layered backdrop (both `pointer-events:none`, `z-index:0`, content sits at
`z-index:6`):

1. **Blueprint grid** — `--bp-grid-field` at `--bp-grid-size` (38px), violet 6% lines.
2. **Ambient glows** — `--bp-glow-field` (pink top-right + teal bottom-left radials).

For web-components, expose these via a backdrop element (analogous to aurora's
`tc-artboard-backdrop` / glow-field). `tc-theme` is `display:contents` so it paints no box —
the grid+glow must go on a real container.

---

## 8. Component recipes

Each recipe lists the exact template treatment so component partials can reproduce it.

### 8.1 Nav
- Container `max-width:1180px`, padding `24px 32px`, flex space-between.
- Brand: 26px SVG diamond (`polygon`, `fill: rgba(224,17,114,.1)`, `stroke:#e01172` 1.6px) + wordmark `WEBGAME` ink + `.CLOUD` faint (`#8e89b3`).
- Links: mono 13px uppercase, `#5d5887`.
- Nav CTA "OPEN CONSOLE": teal fill `#0aa89a`, white text, radius 4px, shadow `--bp-glow-teal`, hover `#0bbcab`.

### 8.2 Buttons

| Variant | Fill | Text | Border | Radius | Shadow | Hover |
|---|---|---|---|---|---|---|
| Primary (pink) | `#e01172` | `#fff` | — | 5px | `0 6px 20px rgba(224,17,114,.3)` | bg `#f5237f` |
| Action (teal) | `#0aa89a` | `#fff` | — | 4px | `0 4px 14px rgba(10,168,154,.32)` | bg `#0bbcab` |
| Outline (neutral) | `#fff` | `#1a1830` | `1px #c5c1e0` | 5px | — | border+text → teal `#0aa89a` |
| Outline (plan) | transparent | accent hue | `1px` accent | 5px | — | fill accent, text `#fff` |

All buttons: Chakra Petch 700, uppercase, 14–15px, padding ≈ `13–16px` vertical, `26–32px`
horizontal. Outline-plan buttons invert to a solid accent fill on hover.

### 8.3 Eyebrow / status pill
`display:inline-flex`, gap 9px, mono 11px 600, tracking **.18em**, teal text `#0aa89a`,
`1px rgba(10,168,154,.4)` border, `rgba(10,168,154,.06)` fill, radius 3px. Leading **pulsing
dot**: 7×7px teal circle (`border-radius:50%`), `animation: dvglow 1.4s infinite`.

### 8.4 Feature card (HUD panel)
- White surface, `1px #e3e0f2`, radius 8px, padding 24px, shadow `0 2px 10px rgba(40,30,90,.05)`.
- **HUD corner-bracket**: an absolutely-positioned 12×12px element at `top:8px;left:8px` with only `border-left` + `border-top` (`2px solid <accent>`) — an L-shaped tick in the card's accent.
- Micro-label: mono 12px 700, accent-colored, e.g. `P-01 · PROJECTS`.
- Title: Chakra Petch 19px 600 ink. Body: 14px `#5d5887`.
- **Hover**: border swaps to the card's accent hue.

### 8.5 Spotlight card (P-04 — Live Configs)
- Spans 2 grid columns, flex row (text + icon).
- Pink soft gradient `linear-gradient(135deg,#fde4ee,#fff)`, `1px #f3bcd4`, radius 8px, padding 26px.
- Pink micro-label, 24px Chakra Petch 700 title.
- Right: 74×74 SVG "gear/target" — pink stroke circle + center dot + tick lines.

### 8.6 Tool chips
Row of `flex-wrap` chips: `1px #d8d4ec`, radius 5px, padding `10px 15px`, mono 13px 600 ink,
leading `◈` glyph. **Hover**: border + text → that chip's accent hue (teal/violet/pink/amber
rotate).

### 8.7 Pricing cards

| | Default plan | Popular plan |
|---|---|---|
| Surface | `#fff` | `#fff` |
| Border | `1px #e3e0f2` | `1.5px #e01172` |
| Radius | 10px | 10px |
| Padding | 28px | 28px |
| Shadow | `0 2px 12px rgba(40,30,90,.05)` | `0 12px 34px rgba(224,17,114,.18)` |
| Align | center | center, `position:relative` |

- Ship SVG (46×46 polygon, accent stroke + soft accent fill) atop each card.
- Plan name: mono 13px 700 accent-colored. Price: Chakra Petch 42px 700 ink; `/mo` faint 15px 500.
- Feature `<ul>`: list-style none, gap 11px, glyph bullets (`◦` indie, `◆` plus, `◇` studio), text `#3c3960` (or ink on popular).
- **Popular ribbon**: absolutely positioned `top:-11px; left:50%` translateX(-50%); pink fill, white mono 10px 700 tracking .12em, radius 4px, text `★ POPULAR`.

### 8.8 Stat ticker (marquee)
Full-width strip, `border-top`+`border-bottom` `1px #d9d5ee`, bg `rgba(255,255,255,.5)`,
`overflow:hidden; white-space:nowrap`. Inner `inline-flex` `animation: dvmarq 26s linear
infinite`, mono 13px 600 faint `#8e89b3`, tracking .1em, items joined by `◇`.

### 8.9 CTA panel
Big rounded panel: `1px #d4d0ea`, radius 14px, gradient `linear-gradient(135deg,#fff,#f3eefc)`,
padding `60px 40px`, centered, shadow `0 14px 40px rgba(40,30,90,.1)`. h2 46px with the closing
phrase highlighted teal `#0aa89a`. Two buttons (pink primary + neutral outline).

### 8.10 Panel chrome / HUD readout
- Panel header bar: padding `10px 14px`, `border-bottom 1px #e9e6f6`, mono 10px 600 faint; left status `● LIVE BUILD` in pink `#e01172`, right caption in faint.
- HUD readout (top-right of art): mono 10px 600, teal lines with pink `BUILD ✓ PASS` + amber `⬡ 7 BUNDLES`.

### 8.11 Vector / wireframe art
Light-mode treatment: SVG polygons `fill:none` or low-opacity accent fill, accent strokes
2–2.6px, soft drop-shadow filter (`feDropShadow dy=2 stdDeviation=2 flood-color:#5b3df2
flood-opacity:.25`). Blueprint perspective floor: violet grid (`rgba(91,61,242,.3/.22)` lines,
44px) `transform: perspective(220px) rotateX(62deg)` masked to fade. No neon glow (that's the
dark 2a variant).

### 8.12 Glyph vocabulary
`◇` ticker separator · `◈` tool chip bullet · `◦`/`◆`/`◇` plan list bullets · `●` live dot ·
`⬡` bundle · `★` popular · `▶` watch-tour. Inline text glyphs, not icon assets.

---

## 9. Layout & spacing

| Token | Value |
|---|---|
| Content max-width | `1180px` |
| Section h-padding | `32px` |
| Nav padding | `24px 32px` |
| Hero grid | `1.02fr .98fr`, gap `44px` |
| Feature grid | `repeat(3,1fr)`, gap `16px` (spotlight `grid-column: span 2`) |
| Pricing grid | `repeat(3,1fr)`, gap `16px`, `align-items:start` |
| Card padding | features `24px` · spotlight `26px` · pricing `28px` |
| Section vertical rhythm | ~`64–72px` top padding per block |

Mobile-first (per styleguide): collapse the 3-col feature/pricing grids to 1 col and the hero
2-col to stacked at small widths. The template is desktop-only markup — add the responsive
ladder when building.

---

## 10. Motion

Keyframes reused from the template (`@keyframes`):

| Name | Effect | Used by |
|---|---|---|
| `dvglow` | opacity .5↔1, 1.4s | status dot |
| `dvgrid` | bg-position 0→44px, 1.6s linear | perspective floor |
| `dvmarq` | translateX 0→-50%, 26s linear | ticker |
| `dvdrift` | translate+rotate wobble, 7–11s | floating asteroids |

Hover transitions are simple color/border/shadow swaps. Honor `prefers-reduced-motion` (disable
the looping marquee/grid/drift) when implementing.

---

## 11. Accent color-role rotation

The design cycles four hues across parallel elements for an arcade feel. Preserve this mapping:

| Slot | Hue |
|---|---|
| Feature P-01 Projects · P-06 Tools · INDIE plan · CTA highlight · nav action | **Teal** `#0aa89a` |
| Feature P-02 Files · STUDIO plan · "backend." | **Violet** `#5b3df2` |
| Feature P-03 Builds · P-04 Live Configs · INDIE PLUS · primary CTA · "We run the" | **Pink** `#e01172` |
| Feature P-05 Team · normal-maps chip · HUD bundles | **Amber** `#d98a14` |

So **pink** is the primary brand/CTA hue; **teal** is the everyday action hue; **violet** and
**amber** are supporting accents. Reflect this in `--tc-app-accent` (pink) and `--bs-primary`.

---

## 12. Proposed `--tc-*` remap

Drop-in remap for `style/themes/blueprint/_foundation.scss` (after declaring `--bp-*`). This
single block re-skins every component because `--bs-<component>-*` defaults resolve through it.

```scss
--tc-font-sans: 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--tc-font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
// NOTE: headings want Chakra Petch — there is no --tc-font-display token in the
// contract, so set heading font-family via a component partial / global rule.

--tc-white: #ffffff;
--tc-black: #000000;

--tc-surface:        var(--bp-paper);     // #fff
--tc-surface-muted:  #f4f3fb;
--tc-surface-hover:  #faf9ff;
--tc-surface-dark:   var(--bp-text);      // #1a1830 (dark chrome on light theme)
--tc-border:         var(--bp-border);        // #e3e0f2
--tc-border-faint:   var(--bp-border-faint);  // #e9e6f6
--tc-border-strong:  var(--bp-border-strong); // #d4d0ea
--tc-text:           var(--bp-text);          // #1a1830
--tc-text-muted:     var(--bp-text-muted);    // #5d5887
--tc-text-faint:     var(--bp-text-faint);    // #8e89b3
--tc-text-inverse:   #ffffff;                 // text on dark/ink — keep LIGHT

--tc-ink:   #1a1830;     // dark surfaces (tooltips, code, footers)
--tc-ink-2: #2a2748;

// App accent = PINK (primary actions / CTA / links)
--tc-app-accent:          var(--bp-pink);        // #e01172
--tc-app-accent-hover:    var(--bp-pink-hover);  // #f5237f
--tc-app-accent-contrast: #ffffff;
// Solid pink — no dark slate stop (that's the default-theme gradient that would
// muddy a bright accent; see aurora's note).
--tc-app-accent-gradient: linear-gradient(135deg, var(--bp-pink), #f5237f);

// Accent (highlights / focus / brand dot) — teal reads as the "action" hue.
--tc-accent:      var(--bp-teal);
--tc-accent-fg:   #097f74;          // darker teal so accent TEXT clears AA on white
--tc-accent-soft: var(--bp-teal-soft);
--tc-accent-hex:  #0aa89a;

--tc-success:    var(--bp-teal);    --tc-success-bg: rgba(10,168,154,.12);
--tc-info:       var(--bp-violet);  --tc-info-bg:    var(--bp-violet-soft);
--tc-warning:    var(--bp-amber);   --tc-warning-bg: var(--bp-amber-soft);
--tc-danger:     #dc2626;           --tc-danger-bg:  #fee2e2;   // keep real red

--tc-shadow-sm:    var(--bp-shadow-sm);
--tc-shadow-md:    var(--bp-shadow-md);
--tc-shadow-lg:    var(--bp-shadow-lg);
--tc-shadow-hover: 0 12px 34px rgba(40,30,90,.14);

--tc-transition-fast: 0.15s ease;
--tc-transition-base: 0.2s cubic-bezier(0.4, 0, 0.2, 1);

--tc-focus-ring: 0 0 0 0.2rem rgba(224,17,114,.20);  // pink halo
```

---

## 13. Proposed `--bs-*` contract overrides

```scss
--bs-primary: var(--bp-pink);    --bs-primary-rgb: 224,17,114;
--bs-secondary: var(--bp-text-muted);
--bs-success: var(--bp-teal);    --bs-success-rgb: 10,168,154;
--bs-info:    var(--bp-violet);  --bs-info-rgb: 91,61,242;
--bs-warning: var(--bp-amber);   --bs-warning-rgb: 217,138,20;
--bs-danger:  #dc2626;           --bs-danger-rgb: 220,38,38;

--bs-body-font-family: var(--tc-font-sans);
--bs-body-bg:    var(--bp-bg);   --bs-body-bg-rgb: 238,241,248;
--bs-body-color: var(--bp-text); --bs-body-color-rgb: 26,24,48;
--bs-emphasis-color: var(--bp-text);

--bs-border-color: var(--bp-border);
--bs-border-radius: var(--bp-r-md);   // 5px — ⚠ overrides the sharp mandate (§1)

--bs-link-color: var(--bp-pink);
--bs-link-hover-color: var(--bp-pink-hover);

--bs-box-shadow-sm: var(--tc-shadow-sm);
--bs-box-shadow:    var(--tc-shadow-md);
--bs-box-shadow-lg: var(--tc-shadow-lg);
--bs-focus-ring-color: rgba(224,17,114,.20);
```

---

## 14. Component partials to add (`style/themes/blueprint/components/`)

Structure a flat token swap can't carry — mirror aurora's `components/` approach:

1. **Backdrop** — blueprint grid + ambient glow field on a container (`--bp-grid-field` /
   `--bp-glow-field`).
2. **Card corner-brackets** — the L-shaped 12×12 HUD tick (`::before`, accent-colored,
   `border-left`+`border-top` 2px), plus accent-on-hover border swap.
3. **Rounded-corner override** — re-point component radii (cards 8–10px, buttons/inputs 5px,
   modal/panel 8–14px) since the base partials assume `border-radius: 0`.
4. **Display headings** — apply Chakra Petch + uppercase + tight tracking to `tc-*` heading
   slots (no `--tc-font-display` token exists).
5. **Accent rotation utilities** — optional helpers so feature grids can cycle teal/violet/pink/
   amber per item.
6. **Status pill / eyebrow** — mono uppercase pill with pulsing dot.
7. **Pricing "popular" ribbon** — the floating top-center badge.

---

## 15. Cautions / open decisions

- **Radius vs mandate (§1)** — the single biggest divergence. The base component partials
  hard-code `border-radius: 0` in places; a blanket `--bs-border-radius` override won't reach
  those. Audit and override per-component. This is intentional, per user request.
- **No display-font token** — the contract only has `--tc-font-sans` / `--tc-font-mono`. Chakra
  Petch headings need a component partial or a `--bp-font-display` convention; decide which.
- **Slate-token leak** (see memory `wc-slate-token-leak`) — any component referencing raw
  `var(--tc-slate-*)` will inherit the *light slate* ramp, which is close-but-wrong on this
  lavender palette. Route separators → `--tc-border-faint`, tracks → `--tc-border`; don't leave
  bare slate refs.
- **Bright-accent traps** (see memory `wc-theme-bright-accent-trap`) — pink/teal are bright.
  Decouple link color from app-accent where the default theme assumes a dark slate ink; verify
  on-fill text contrast (white-on-pink ✓, white-on-teal ✓). `--tc-accent-fg` is darkened
  (`#097f74`) so teal *text* on white clears AA.
- **Font loading** — Space Grotesk / Chakra Petch / JetBrains Mono are not bundled; load on the
  host page. All degrade to system fonts.
- **Danger ≠ pink** — keep a true red for the danger semantic so error states don't read as the
  brand CTA.
- **Reduced motion** — gate the marquee / grid-scroll / drift loops behind
  `prefers-reduced-motion`.
```

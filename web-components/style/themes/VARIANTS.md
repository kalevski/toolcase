# Theme accent variants

Every bundled theme (`default`, `dungeon`, `aurora`, `sunshine`, `neon`, `blueprint`)
ships eleven **accent variants**. A variant swaps **only the primary and
secondary accent colours** — plus everything mechanically derived from them
(hover shades, soft tints, hairlines, glows, gradients, focus rings, link
colours and the Bootstrap-compat `--bs-primary*` contract). The rest of the
theme is untouched: canvas, surfaces, borders, text ramp, semantic status
colours (success / info / warning / danger), fonts, radii and structural
styling all stay the base theme's.

## The eleven variants

| Variant     | Primary                    | Secondary  |
| ----------- | --------------------------- | ---------- |
| `ocean`     | blue                        | cyan       |
| `forest`    | green                       | lime       |
| `ember`     | orange                      | gold       |
| `royal`     | violet                      | magenta    |
| `mint`      | teal                        | mint       |
| `rose`      | rose                        | pink       |
| `crimson`   | red                         | coral      |
| `indigo`    | indigo                      | periwinkle |
| `slate`     | steel                       | silver     |
| `sunset`    | **gradient** coral → orange | amber      |
| `twilight`  | **gradient** violet → blue  | sky-blue   |

`slate` is deliberately desaturated/muted — a "quiet" pairing among the
otherwise saturated set — while the rest lean vivid.

`sunset` and `twilight` are the two **gradient variants**: unlike every other
variant, the primary accent is a two-stop `linear-gradient()` — the widely-used
"Sunset" (coral → orange) and "Deep Blue" (violet → blue) combinations — rather
than a single flat colour. The solid `--tc-app-accent` (and its per-theme
equivalents) still resolves to the gradient's start hue for non-gradient
contexts (icons, borders, focus rings); the CTA gradient itself is what buttons,
nav accents and brand marks actually paint. See "Authoring a gradient variant"
below for how each theme's existing gradient-recipe token is repurposed to
carry a genuine two-hue sweep instead of a same-hue lighten.

The hues are shared across all themes; the exact shades are tuned per theme so
each variant keeps the base theme's contrast conventions (mid-tone accents with
white on-fill ink on light canvases, bright accents with dark ink on dark
canvases, muted antiqued shades for dungeon, fully saturated electrics for neon).

## Usage

```html
<!-- custom element -->
<tc-theme name="blueprint" variant="ocean"> … </tc-theme>

<!-- plain wrapper -->
<div data-tc-theme="aurora" data-tc-variant="ember">…</div>
```

```ts
// dynamic switching
const el = document.querySelector('tc-theme')
el.variant = 'royal' // set
el.variant = '' // back to the theme's base accents
```

## Architecture

Each theme owns a `variants/` directory with one partial per variant plus an
`_index.scss` forwarding them; the theme's `_index.scss` loads `variants` after
`foundation` (so variant tokens override the base accents) and before
`components` where present.

A variant partial is scoped with double-attribute selectors, which out-specify
the single-attribute foundation scope:

```scss
tc-theme[name='blueprint'][variant='ocean'],
[data-tc-theme='blueprint'][data-tc-variant='ocean'] { … }
```

Rules for authoring a variant (or adding a new one):

1. Override **only** the theme's primary and secondary accent token families
   and their derived literals (rgb triplets, `rgba()` tints, gradients, glows,
   focus rings, links). Never touch canvas / paper / border / text / status
   tokens.
2. Recompute every `rgba()` derivative from the new hexes using the **same
   alpha values** as the base foundation, so tint and glow intensity match.
3. If the base foundation routes a semantic status token (e.g. `--tc-success`)
   through an accent var you are overriding, re-pin that status token to the
   base theme's original literal inside the variant — status colours must not
   shift with the variant.
4. Keep the base theme's ink-on-fill convention (white vs dark ink on accent
   fills) and hover direction (lighter on dark canvases, darker on light).

## Authoring a gradient variant

Every theme already builds its CTA fill from a two-var gradient recipe —
`--tc-app-accent-gradient` (default, dungeon), `--ah-accent-grad` (aurora),
`--bp-pink-grad` (blueprint), `--nd-accent-grad` (neon) or `--sun-lead-grad`
(sunshine) — combining a "base" var and a "second stop" var that, in every
solid-hue variant, is just a lighter/darker shade of the SAME hue. A gradient
variant's only real trick is setting that second-stop var to a **genuinely
different hue** instead of a shade, so the theme's own existing recipe renders
a true two-tone sweep with no new plumbing:

| Theme       | Base var       | Second-stop var (repoint to the 2nd gradient hue) |
| ----------- | -------------- | -------------------------------------------------- |
| `default`   | —              | override `--tc-app-accent-gradient` directly (no separate recipe var) |
| `dungeon`   | `--fg-<name>-primary-bright` | `--fg-<name>-primary-deep` |
| `aurora`    | `--ah-accent`  | `--ah-accent-2` |
| `blueprint` | `--bp-pink`    | `--bp-pink-hover` |
| `neon`      | `--nd-accent`  | `--nd-accent-2` |
| `sunshine`  | `--sun-lead`   | `--sun-lead-hi` |

Because that second-stop var is also consumed elsewhere as an actual hover/link
shade, repointing it to a different hue means hover states shift along the
gradient too (e.g. a coral button hovers toward orange) — that's an intentional
extension of the effect, not a bug. Two follow-on notes:

- **sunshine brightness class:** `--sun-lead`/`--sun-lead-hi` must stay in the
  same brightness range as the theme's other leads (~L 64–74%, so dark on-lead
  ink still reads) — brighten the popular gradient's hexes if the canonical
  values run darker (this is why sunshine's `twilight` uses `#a78bfa → #60a5fa`
  rather than the darker `#6a11cb → #2575fc` used elsewhere).
- **Solid fallback:** still set the primary's flat/solid token (`--tc-app-accent`,
  `--ah-accent`, `--bp-pink`, `--nd-accent`, `--sun-lead`) to the gradient's
  *start* hue, exactly like a solid-hue variant — it's what non-gradient
  contexts (icons, borders, `--bs-primary-rgb`, focus rings) resolve to.

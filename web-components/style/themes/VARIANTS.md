# Theme accent variants

Every bundled theme (`default`, `dungeon`, `aurora`, `sunshine`, `neon`, `blueprint`)
ships four **accent variants**. A variant swaps **only the primary and secondary
accent colours** — plus everything mechanically derived from them (hover shades,
soft tints, hairlines, glows, gradients, focus rings, link colours and the
Bootstrap-compat `--bs-primary*` contract). The rest of the theme is untouched:
canvas, surfaces, borders, text ramp, semantic status colours
(success / info / warning / danger), fonts, radii and structural styling all stay
the base theme's.

## The four variants

| Variant  | Primary | Secondary |
| -------- | ------- | --------- |
| `ocean`  | blue    | cyan      |
| `forest` | green   | lime      |
| `ember`  | orange  | gold      |
| `royal`  | violet  | magenta   |

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

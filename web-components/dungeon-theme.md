# Dungeon Theme — per-component conversion guide

This guide tells you (Claude) how to take **one** `@toolcase/web-components` component and
re-skin it so it looks identical to its `@toolcase/game-components` counterpart — the aged
**parchment / gilded bronze / ink / runes** fantasy aesthetic.

The theme lives at `web-components/style/themes/dungeon/`. It is **opt-in**: it only applies
inside a theme root — `<tc-theme name="dungeon"> … </tc-theme>`. Everything outside the
wrapper keeps the default toolcase (slate / product) voice.

> **You are usually converting ONE component at a time.** Most components already ship a TODO
> stub at `style/themes/dungeon/components/_<name>.scss`. Your job is to fill that stub in
> using the recipe below, then recompile. Do **not** touch the source component code, the
> default theme, or the base `style/components/_<name>.scss` — the dungeon theme is a pure
> override layer.

---

## 1. Why this works — the two design systems

| | `game-components` (`gc-*`) | `web-components` (`tc-*`) |
|---|---|---|
| DOM | **Shadow DOM**; global CSS styles the host (`gc-panel[bordered]`) + slotted light content | **Light DOM**; component renders BEM classes (`.tc-panel`, `.tc-panel--bordered`) into the document |
| Styling | Fantasy chrome **hard-coded** into each `_*.scss` using `--fg-*` palette tokens | Every cosmetic flows through `--bs-<component>-*` custom properties whose **defaults resolve to `--tc-*` design tokens** |
| Theming | one look only | `--tc-*` / `--bs-*` are the public theming contract; swap them and the component reskins |

Because `tc-*` components are **100% variable-driven and light-DOM**, a theme is just:

1. **Token remap** (done once, globally) — re-point `--tc-*` / `--bs-*` to the fantasy palette.
   This is already implemented in `themes/dungeon/_foundation.scss` and reskins the colours,
   borders, and fonts of **all 111 matched components at once**.
2. **Per-component structural overrides** — add the fantasy *structure* a flat token swap
   can't carry: gilded bevel shadow stacks, corner notches, display-caps typography, diamond
   ornaments, gradient fills wired to non-tokenised properties.

Your per-component file only does step 2. Step 1 already happened.

---

## 2. The theme root selector & file layout

Every rule you write is scoped under the theme root selector. Two activation forms
are accepted (always author BOTH so either works):

```scss
tc-theme[name='dungeon'],
[data-tc-theme='dungeon'] {
    /* token overrides + structural rules go here */
}
```

- `<tc-theme name="dungeon">` — the custom element (display:contents wrapper).
- `[data-tc-theme="dungeon"]` — a data attribute on any element (e.g. a plain div).
  The examples site applies the theme this way: `<div data-tc-theme="dungeon">`.

Specificity math (why your overrides win):

- `tc-theme[name='dungeon'] tc-panel` = (0,1,1) **beats** the base `tc-panel` = (0,0,1).
- `tc-theme[name='dungeon'] .tc-panel` = (0,2,0) **beats** the base `.tc-panel` = (0,1,0).
- Some components set their `--bs-*` defaults on the **class** (`.tc-eyebrow`, `.tc-rarity-chip`,
  `.tc-divider`, `.tc-currency-chip`, `.form-check`), not the host element. Match the **same
  selector** (prefixed with the theme root) so your override wins. The file header notes this
  when it applies.

File layout:

```
web-components/style/themes/dungeon/
  _index.scss            @use 'foundation'; @use 'components';
  _foundation.scss       --fg-* palette + --tc-*/--bs-* remap (the global reskin)
  components/
    _index.scss          @use './<name>'; for all 111 matched components
    _<name>.scss          one file per component (implemented OR TODO stub)
```

The bundle is wired in `style/index.scss` (last `@use`), so the dungeon CSS ships inside the
single `lib/index.css` and is inert until a `<tc-theme name="dungeon">` wrapper opts in.

---

## 3. The `--fg-*` palette (defined in `_foundation.scss`)

Use these tokens — **never** invent new hex literals except inside the named gradients below
(those are exact values from the fantasy contract and are allowed).

**Surfaces** `--fg-ink #1a140d` · `--fg-ink-2 #221912` · `--fg-leather #2a1f14` · `--fg-leather-2 #3a2a1c` · `--fg-leather-3 #4a3422`
**Parchment** `--fg-parch #e8dcc4` · `--fg-parch-2 #d6c5a3` · `--fg-parch-3 #b8a47e` · `--fg-parch-dim #8b7a5e`
**Gold (primary accent)** `--fg-gold #c9a961` · `--fg-gold-bright #f0d27a` · `--fg-gold-deep #8b6f3a` · `--fg-gold-shadow #5a4422`
**Other metals** `--fg-bronze` · `--fg-copper #a06a3a` · `--fg-silver #c5cfd6`
**Elements** `--fg-blood(/-bright)` HP/danger · `--fg-mana(/-bright)` MP · `--fg-stamina(/-bright)` stamina · `--fg-arcane(/-bright)` · `--fg-poison` · `--fg-fire` · `--fg-frost`
**Rarity** `--fg-common #9c9489` · `--fg-uncommon #5fa84a` · `--fg-rare #4a7fcf` · `--fg-epic #a44dd0` · `--fg-legendary #e8a23a` · `--fg-mythic #e04d6a`
**Type** `--fg-display` (Cinzel serif, caps) · `--fg-body` (EB Garamond serif) · `--fg-mono` (JetBrains Mono)

**Reusable recipe tokens** (also in `_foundation.scss` — prefer these over re-typing gradients):

| Token | What it is |
|---|---|
| `--fg-panel-bg` | the wood gradient panel fill |
| `--fg-panel-shadow` | full inset bevel stack + drop shadow |
| `--fg-bevel-top` | `inset 0 1px 0 rgba(232,200,120,.2)` top highlight band |
| `--fg-slot-bg` | radial wood slot fill |
| `--fg-button-bg` | `linear-gradient(180deg,#3a2a1a,#1f1610)` |
| `--fg-keycap-bg` | key cap gradient |
| `--fg-rule` | gold gradient hairline (dividers) |
| `--fg-gold-edge` | gold gradient (diamond / handle) |
| `--fg-notch-fill` + `--fg-notch-clip` | the corner-notch glyph |
| `--fg-scanlines` | resource-bar fill scanline overlay |

> Fonts `Cinzel` / `EB Garamond` are **not bundled** — the host page should load them
> (e.g. Google Fonts). They degrade to `Georgia, serif`.

Full visual contract (every measurement, every state): see
`.claude/skills/gc-component/style_guidelines.md` and the source `game-components/style/components/_<name>.scss`.

---

## 4. Conversion recipe — converting one component

1. **Open both sources.**
   - Design source: `game-components/style/components/_<name>.scss` (+ the `gc-<Name>.ts` if you
     need to see the markup it styles). This is the look you're matching.
   - Target classes: `web-components/style/components/_<name>.scss`. This tells you the exact
     class names (`.tc-<name>`, `.tc-<name>__part`, `.tc-<name>--modifier`) and which
     `--bs-<name>-*` variables already exist.
2. **Read the target's `--bs-<name>-*` contract.** Anything the base exposes as a variable, you
   override as a variable — that's the clean path. List them.
3. **Token-swap first.** In your `tc-theme[name='dungeon'] { … }` block, set the
   `--bs-<name>-*` variables to fantasy values (gold borders, wood/ink fills, gold-bright
   accents, rarity/element colours). Set them on the **same selector the base used** (host
   element vs class — check the base file).
4. **Add the missing structure.** Whatever the fantasy version has that isn't a variable:
   - Gilded **bevel** → add `box-shadow: var(--fg-panel-shadow)` (or a slot/button bevel) to the
     framed element's class.
   - **Corner notches** → `::before` / `::after` with `--fg-notch-fill` + `--fg-notch-clip` on
     the bordered element (give it `position: relative`).
   - **Display caps** → on the label/title class set `font-family: var(--fg-display);
     text-transform: uppercase; letter-spacing: 0.16–0.18em; font-weight: 600;`. (The base
     usually hardcodes `font-family: var(--tc-font-sans)` on the inner element, so you must
     override the **class**, not just a var.)
   - **Mono numerals** → `font-family: var(--fg-mono)` on numeric parts (qty, hp, ping, hotkey…).
     Globally `--tc-font-mono` is already mono, so this only matters where the base hardcodes a
     family.
   - **Gradient fills / scanlines / glows** → wire to the class directly (e.g. resource-bar
     `__fill::after` scanline overlay).
5. **Keep it sharp.** No `border-radius` except the sanctioned circles (portrait circle variant,
   toggle/slider that you may deliberately re-square, radio dot). If the base added a pill/round
   curve that the fantasy version is square, override `border-radius: 0`.
6. **Don't fight `:focus-visible`.** The fantasy focus ring is
   `outline: 2px solid var(--fg-gold-bright)` — the foundation already remaps `--tc-app-accent`
   to gold, so most focus rings turn gold for free. Only override if the base hardcodes a slate
   colour.
7. **Recompile & spot-check** (§6).

### Checklist (paste into your head per component)

- [ ] All `--bs-<name>-*` vars repointed to `--fg-*` values
- [ ] Framed surfaces have the inset bevel + (if it's a "panel") corner notches
- [ ] Labels/titles use `--fg-display` caps + wide tracking; numerals use `--fg-mono`
- [ ] Borders are `--fg-gold-deep` (default) / `--fg-gold` (strong); fills are wood/ink gradients
- [ ] Rarity / element / status colours use the `--fg-*` ramp
- [ ] Sharp corners (no stray `border-radius`)
- [ ] Compiles clean; rule appears under `tc-theme[name=dungeon]` in `lib/index.css`

---

## 5. Worked example — `_panel.scss`

**Base** (`web-components/style/components/_panel.scss`) exposes `--bs-panel-bg`,
`--bs-panel-border-color`, `--bs-panel-body-padding` on `tc-panel`; the rendered markup is
`.tc-panel` › `.tc-panel--bordered` (border only, **no** shadow) › `.tc-panel-body`.

**Fantasy** (`game-components/style/components/_panel.scss`) adds a wood radial gradient, a 4-layer
inset gold bevel + drop shadow, and top corner notches via `::before/::after`.

**Override** (`themes/dungeon/components/_panel.scss`):

```scss
tc-theme[name='dungeon'] {
    tc-panel {                                    // 1. token swap on the host
        --bs-panel-bg: var(--fg-panel-bg);
        --bs-panel-border-color: var(--fg-gold-deep);
        --bs-panel-body-padding: 14px;
    }
    .tc-panel { position: relative; color: var(--fg-parch); }
    .tc-panel--bordered {                         // 2. structure: bevel the base lacks
        border: 1px solid var(--fg-gold-deep);
        box-shadow: var(--fg-panel-shadow);
    }
    .tc-panel--bordered::before,                  // 3. structure: corner notches
    .tc-panel--bordered::after {
        content: ''; position: absolute; top: -1px; width: 14px; height: 14px;
        pointer-events: none;
        background: var(--fg-notch-fill); clip-path: var(--fg-notch-clip);
    }
    .tc-panel--bordered::before { left: -1px; }
    .tc-panel--bordered::after  { right: -1px; transform: scaleX(-1); }
    .tc-panel-header {                            // 4. display caps header
        font-family: var(--fg-display); text-transform: uppercase;
        letter-spacing: 0.16em; font-weight: 600;
    }
}
```

That is the whole pattern: **swap vars, then add the structure vars can't express.**

---

## 6. Build & verify

```bash
# from web-components/
npm run build:css      # sass style/index.scss:lib/index.css (compressed)
# or a throwaway expanded build to eyeball selectors:
npx sass style/index.scss:/tmp/dungeon.css --no-source-map
grep "tc-theme\[name=dungeon\] .tc-<name>" /tmp/dungeon.css   # confirm your rule emitted
```

Visual check: in `examples/`, wrap a demo in `<tc-theme name="dungeon">…</tc-theme>` and compare
side-by-side with the `gc-<name>` original. An **empty** `tc-theme[name='dungeon'] {}` block (a
TODO stub) compiles to nothing, so unconverted components simply inherit the foundation reskin.

---

## 7. Status — what's implemented

**All 111 matched components are implemented.** No TODO stubs remain. Use any of these files as
a reference pattern when extending the theme; the foundational primitives —
`panel`, `gilded-frame`, `metal-button`, `nav-button`, `menu-item`, `item-slot`, `resource-bar`
(+ health/mana/stamina), `boss-bar`, `title`, `subtitle`, `eyebrow`, `lore-text`, `key`,
`divider`, `rarity-chip`, `currency-chip`, `portrait`, `toggle`, `check`, `tab-bar`, `list-row`,
`rune-corner`, `artboard-backdrop` — carry the cleanest examples of the swap-vars-then-add-structure
pattern.

Six components are intentional **no-ops** (empty `tc-theme[name='dungeon'] {}` blocks): the pure
layout / behaviour primitives `anchor`, `aspect-ratio-box`, `grid`, `safe-area`, `shake-container`,
`stack` — they have no colours/borders/text, so the foundation reskin covers any inherited cosmetics.

> The matched set is the 111 components present in **both** packages (intersection of the two
> `style/components` dirs). web-components has ~227 extra components (dashboards, charts, forms)
> with no game-components counterpart — those are intentionally **not** themed.
>
> To re-skin a component differently, edit its `style/themes/dungeon/components/_<name>.scss`
> and run `npm run build:css`. Adding a new matched component? Create the partial, add a
> `@use './<name>';` line to `components/_index.scss`, and follow §4.

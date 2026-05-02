# Fantasy Game UI — Style Guidelines

Authoritative visual contract for `gc-*` Lit web components in `game-components/`. Derived from `game_theme/` (`fantasy.css`, `fg-primitives.jsx`, `fg-atoms.jsx`, `fg-menus.jsx`, `fg-hud.jsx`, `fg-inventory.jsx`, `fg-progression.jsx`).

Aesthetic: **aged parchment, gilded bronze, ink, runes**. Square frames (no rounding except medallions/diamonds), beveled gold rules, dark wood/leather backdrops, mono numerals, serif display caps with wide tracking.

> **Note for component authors**: every `gc-*` component must consume tokens listed here — never inline literal hex/colors except where this doc names exact values for non-token decorations (gradients, shadows). The toolcase tokens in `colors_and_type.css` are NOT used here; this is a separate fantasy theme rooted in `--fg-*` tokens.

---

## 1. Design Tokens

### 1.1 Surfaces — wood / ink / leather

| Token | Hex | Usage |
|---|---|---|
| `--fg-ink` | `#1a140d` | page background, dark panel base |
| `--fg-ink-2` | `#221912` | secondary dark surface |
| `--fg-leather` | `#2a1f14` | leather panel, button base |
| `--fg-leather-2` | `#3a2a1c` | mid leather |
| `--fg-leather-3` | `#4a3422` | raised leather |

### 1.2 Parchment / cream

| Token | Hex | Usage |
|---|---|---|
| `--fg-parch` | `#e8dcc4` | primary text on dark, parchment surface top |
| `--fg-parch-2` | `#d6c5a3` | parchment surface bottom |
| `--fg-parch-3` | `#b8a47e` | secondary text, lore italic |
| `--fg-parch-dim` | `#8b7a5e` | tertiary/muted text, eyebrows |

### 1.3 Metals (gold scale = primary accent)

| Token | Hex | Usage |
|---|---|---|
| `--fg-gold` | `#c9a961` | mid gold (divider, accent line) |
| `--fg-gold-bright` | `#f0d27a` | titles, button text, highlight |
| `--fg-gold-deep` | `#8b6f3a` | borders (default), bevel mid |
| `--fg-gold-shadow` | `#5a4422` | bevel shadow, deep gild |
| `--fg-bronze` | `#8b6f3a` | alias for deep gold |
| `--fg-copper` | `#a06a3a` | alt warm metal |
| `--fg-silver` | `#c5cfd6` | shield resource, alt accent |

### 1.4 Element / resource colors

| Token | Hex / bright variant | Used by |
|---|---|---|
| `--fg-blood` / `--fg-blood-bright` | `#a8302a` / `#d44a3a` | HP, danger button, debuff border |
| `--fg-mana` / `--fg-mana-bright` | `#3a6cc9` / `#5a8cf0` | MP bar |
| `--fg-stamina` / `--fg-stamina-bright` | `#6f9f3a` / `#9fc55a` | stamina bar, buff border, +trend |
| `--fg-arcane` / `--fg-arcane-bright` | `#8a4ec9` / `#b878e8` | arcane FX |
| `--fg-poison` | `#6fb04a` | poison status |
| `--fg-fire` | `#e07330` | fire status |
| `--fg-frost` | `#5fb8d4` | frost status |

### 1.5 Rarity scale (item slots, chips, glow)

| Token | Hex |
|---|---|
| `--fg-common` | `#9c9489` |
| `--fg-uncommon` | `#5fa84a` |
| `--fg-rare` | `#4a7fcf` |
| `--fg-epic` | `#a44dd0` |
| `--fg-legendary` | `#e8a23a` |
| `--fg-mythic` | `#e04d6a` |

Rarity ring on slot = `border-color: var(--fg-{rarity})` + inner glow `inset 0 0 12-18px rgba(<rarity>, 0.25-0.45)` scaling with rarity.

### 1.6 Resource bar palette (`gc-health-bar`, `gc-mana-bar`, `gc-stamina-bar`, etc.)

Each bar kind = triple `{base, bright, shadow}` set as CSS custom props on `.fg-bar`:

```
hp:      { base: #a8302a, bright: #e0584a, shadow: #5a1410 }
mp:      { base: #3a6cc9, bright: #7aaef0, shadow: #1a2e6a }
stamina: { base: #6f9f3a, bright: #a8d65a, shadow: #2a4818 }
xp:      { base: #c9a961, bright: #f0d27a, shadow: #5a4422 }
shield:  { base: #c5cfd6, bright: #f0f4f8, shadow: #5a6470 }
rage:    { base: #d44a3a, bright: #f57052, shadow: #5a1a14 }
```

Fill = `linear-gradient(180deg, var(--c-bright), var(--c-base) 60%, var(--c-shadow))`. Overlay scanlines `repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,0.18) 9px 10px)` mandatory. Ghost overlay = `rgba(255,220,200,0.25)`, transitions `width 0.6s ease-out 0.25s`.

---

## 2. Typography

### 2.1 Families

```
--fg-display: 'Cinzel', 'Trajan Pro', Georgia, serif;
--fg-body:    'EB Garamond', Georgia, 'Times New Roman', serif;
--fg-mono:    'JetBrains Mono', 'Ubuntu Mono', Consolas, monospace;
```

### 2.2 Role mapping (binding)

| Role | Family | Notes |
|---|---|---|
| Display titles, screen titles, button labels, menu items, eyebrows, tab labels, ability names | `--fg-display` | uppercase + wide tracking |
| Body, lore italic, dialogue text, descriptions | `--fg-body` | italic for flavor |
| Numerals (HP/MP, qty, hotkey, stat values, version, timer) | `--fg-mono` | always for numbers |

### 2.3 Eyebrow pattern (signature)

```
font-family: var(--fg-display);
font-size: 0.72rem;          /* 11.5px */
letter-spacing: 0.32em;
text-transform: uppercase;
color: var(--fg-parch-dim);  /* on dark */
font-weight: 500;
```

On parchment: invert color to `var(--fg-ink)`. Hero eyebrow uses `letter-spacing: 0.5em`, `font-size: 12px`.

### 2.4 Title pattern

```
font-family: var(--fg-display);
font-weight: 600;
letter-spacing: 0.18em;
text-transform: uppercase;
color: var(--fg-gold-bright);
```

### 2.5 Display title (hero, screen names)

```
font-family: var(--fg-display);
font-weight: 700;
font-size: 26-44px;
letter-spacing: 0.06-0.12em;
color: var(--fg-gold-bright);
text-shadow: 0 1-2px 0 #000, 0 0 18-24px rgba(232, 200, 120, 0.35);
```

### 2.6 Lore / italic flavor

```
font-family: var(--fg-body);
font-style: italic;
color: var(--fg-parch-3);
font-size: 13-14px;
line-height: 1.5;
```

### 2.7 Mono micro-label (label-row pattern over bars/sliders)

```
font-family: var(--fg-mono);
font-size: 10px;
letter-spacing: 0.16-0.18em;
text-transform: uppercase;
color: var(--fg-parch-3);
```

Right-aligned numeric value = `color: var(--fg-parch)` or `var(--fg-gold-bright)` for emphasis.

---

## 3. Surfaces

### 3.1 `gc-panel` — gilded square frame (THE signature)

Required composition:

```css
position: relative;
background:
  linear-gradient(180deg, rgba(232,220,196,0.04), rgba(0,0,0,0.18)),
  radial-gradient(120% 80% at 50% 0%, #2e2418 0%, #1a130c 70%);
border: 1px solid var(--fg-gold-deep);
box-shadow:
  inset 0 0 0 1px rgba(0,0,0,0.6),
  inset 0 0 0 2px var(--fg-gold-deep),
  inset 0 0 0 3px var(--fg-gold-shadow),
  0 8px 24px rgba(0,0,0,0.6),
  0 2px 0 rgba(255, 220, 150, 0.08) inset;
color: var(--fg-parch);
```

Top corner notches via `::before` / `::after` (14×14, gold gradient, clip-path `polygon(0 0, 100% 0, 100% 35%, 65% 35%, 65% 100%, 0 100%)`). Optional bottom corners via modifier — also include when `corners` prop true on bordered panel.

### 3.2 `gc-gilded-frame` — bare gilded border (no notches)

```css
background: linear-gradient(180deg, #1a1308 0%, #0e0905 100%);  /* tone=dark */
/* or #2a1f14→#1a1308 for tone=leather, or transparent */
border: 1px solid var(--fg-gold-deep);
box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12);
```

Use as content card inside a panel, or flat container without bevel/corners.

### 3.3 Parchment surface variant (menu bodies, codex pages)

```css
background:
  radial-gradient(120% 100% at 30% 10%, rgba(255,240,200,0.12), transparent 60%),
  radial-gradient(80% 60% at 80% 90%, rgba(120,80,30,0.18), transparent 70%),
  linear-gradient(180deg, #e8dcc4 0%, #d6c5a3 100%);
color: var(--fg-ink);
```

Headings/eyebrows on parchment switch to `var(--fg-ink)`.

### 3.4 `gc-artboard-backdrop` (page-level wrap)

```
dark:  radial-gradient(120% 90% at 50% 0%, #1f180e 0%, #0a0604 80%)
scene: radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%),
       linear-gradient(180deg, #1a1308 0%, #0a0604 100%)
parch: linear-gradient(180deg, #1a1308 0%, #0a0604 100%)
```

### 3.5 Grain overlay (optional, on panels)

`::after` pseudo with two layered radial-gradient dot patterns at `3px 3px` / `5px 5px`, `mix-blend-mode: overlay`, `opacity: 0.6`. Apply via `.fg-grain` class composition.

---

## 4. Borders, Bevels, Shadows

- **Default border**: `1px solid var(--fg-gold-deep)`.
- **Beveled inset stack** (panel, button, slot): always include `inset 0 0 0 1px rgba(0,0,0,0.6-0.7)` outermost, then optional inset gold rings, then top highlight `inset 0 1px 0 rgba(232,200,120,0.12-0.25)`.
- **Drop shadow**: `0 2-8px 4-24px rgba(0,0,0,0.6-0.8)` for raised panels; modal-grade is `0 20px 50px rgba(0,0,0,0.8)`.
- **Highlight band**: `inset 0 1px 0 rgba(232,200,120,0.18-0.25)` reads as "light catches the top edge" — apply to panels, buttons, slots, key caps.
- **No `border-radius`** anywhere except `gc-portrait` (circle variant) and the diamond divider ornament.

---

## 5. Corner Notches & Rune Ornaments

- **Notch glyph** (`gc-rune-corner`, `Panel::before/::after`): 12-18px square. Background = `linear-gradient(135deg, var(--fg-gold-bright), var(--fg-gold) 35%, var(--fg-gold-deep) 60%, #2a1c0e)`. Clip-path = `polygon(0 0, 100% 0, 100% 35%, 65% 35%, 65% 100%, 0 100%)`. Variants `tl|tr|bl|br` via transform `scaleX(-1)`, `scaleY(-1)`, `scale(-1,-1)`.
- **Diamond divider** (`gc-divider`): 8×8 square `linear-gradient(135deg, var(--fg-gold-bright), var(--fg-gold-deep))` rotated 45° with `box-shadow: 0 0 6px rgba(232,200,120,0.4)`. Flanked by gradient rule `linear-gradient(90deg, transparent, var(--fg-gold-deep) 30%, var(--fg-gold) 50%, var(--fg-gold-deep) 70%, transparent)` 1px high.

---

## 6. Buttons (`gc-metal-button`, `gc-nav-button`)

### 6.1 Base

```css
font-family: var(--fg-display);
letter-spacing: 0.18em;
text-transform: uppercase;
font-weight: 600;
font-size: 0.78rem;          /* md */
padding: 10px 22px;          /* md */
background: linear-gradient(180deg, #3a2a1a, #1f1610);
color: var(--fg-gold-bright);
border: 1px solid var(--fg-gold-deep);
box-shadow:
  inset 0 1px 0 rgba(232,200,120,0.25),
  inset 0 -8px 12px rgba(0,0,0,0.4),
  0 2px 0 rgba(0,0,0,0.6);
transition: transform 0.12s ease, filter 0.12s ease;
white-space: nowrap;
```

`:hover` → `filter: brightness(1.15); transform: translateY(-1px);`
`:active` → `transform: translateY(1px); filter: brightness(0.9);`

### 6.2 Sizes

| Size | Padding | Font-size |
|---|---|---|
| `sm` | `6px 14px` | `11px` |
| `md` (default) | `10px 22px` | `12.5px` (`0.78rem`) |
| `lg` | `12px 28px` | `14px` |

### 6.3 Variants

| Variant | Background | Border | Color |
|---|---|---|---|
| `default` | `linear-gradient(180deg, #3a2a1a, #1f1610)` | `var(--fg-gold-deep)` | `var(--fg-gold-bright)` |
| `primary` | `linear-gradient(180deg, #5a3a18, #2a1a0a)` | `var(--fg-gold)` | `var(--fg-gold-bright)` |
| `danger` | `linear-gradient(180deg, #5a1a16, #2a0a08)` | `var(--fg-blood)` | `#f4c4be` |
| `ghost` | `transparent` | `var(--fg-gold-deep)` | `var(--fg-parch)` (+ `inset 0 0 0 1px rgba(0,0,0,0.4)`) |

`disabled` → `opacity: 0.45`, `cursor: not-allowed`, no hover transform.

---

## 7. Item Slots (`gc-item-slot`, `gc-hotbar`, `gc-inventory-grid`)

### 7.1 Base slot

```css
width/height: 56px (default; size prop scales);
background: radial-gradient(80% 80% at 50% 30%, #2a1f14, #0e0905);
border: 1px solid var(--fg-gold-deep);
box-shadow:
  inset 0 0 0 1px rgba(0,0,0,0.7),
  inset 0 1px 0 rgba(232,200,120,0.18),
  inset 0 -2px 6px rgba(0,0,0,0.6);
font-size: size * 0.42;       /* glyph */
color: var(--fg-parch-3);
```

### 7.2 States

- **Empty** (`is-empty`): glyph color `rgba(184,164,126,0.18)` or hide.
- **Rarity** (`r-{rarity}`): set `border-color: var(--fg-{rarity})` + outer/inner glow per §1.5.
- **Selected**: `outline: 2px solid var(--fg-gold-bright)` + `box-shadow: 0 0 0 1px #000, 0 0 12px rgba(232,200,120,0.5)`.
- **Cooldown overlay**: `conic-gradient(from -90deg, rgba(0,0,0,0.75) {pct*3.6}deg, transparent 0)`. Center label uses mono 14px white with text-shadow.
- **Locked**: `rgba(0,0,0,0.55)` overlay + lock icon `var(--fg-gold-deep)`.
- **Hotkey badge** (`fg-slot-key`): top-left, mono 10px, `var(--fg-gold-bright)`, text-shadow `0 1px 2px #000`.
- **Quantity** (`fg-slot-qty`): bottom-right, mono 11px, `var(--fg-parch)`.
- **Equipped marker**: small diamond `var(--fg-gold-bright)` at top-right, or "E" badge in mono.

---

## 8. Resource Bars (`gc-resource-bar-base` + subclasses)

Already specified in §1.6. Additional rules:

- **Height**: HP 12-18px, MP 10-12px, stamina 8-10px, XP 8px, boss 24-28px.
- **Label row** (`label` prop): mono 10px micro-label per §2.7 above the bar.
- **Inline text** (no label, `showText`): centered absolute, mono 11px `var(--fg-parch)`, `letter-spacing: 0.08em`, text-shadow `0 1px 2px #000, 0 0 3px #000`.
- **Segments** prop > 1: render N evenly-spaced 1px black dividers (`box-shadow` or pseudo) over fill.
- **Boss bar** (`gc-boss-bar`): height 28px, name in display caps gold above bar, phase ticks as gold notches at `phaseTicks[]` percentages.

---

## 9. Inputs

### 9.1 `gc-toggle` (44×22 switch)

```css
background: linear-gradient(180deg, #0e0905, #1a120a);
border: 1px solid var(--fg-gold-deep);
box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);

/* knob (::after) */
width/height: 18px; top/left: 1px;
background: linear-gradient(180deg, var(--fg-gold-bright), var(--fg-gold-deep));
box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.6);
transition: left 0.15s ease;

/* on */
.on background: linear-gradient(180deg, #2a1a08, #4a2a0e);
.on::after left: 23px;
```

### 9.2 `gc-check` (16×16 square)

Same frame as toggle. Checkmark via `::after` with `clip-path: polygon(15% 50%, 40% 75%, 90% 20%, 90% 35%, 40% 90%, 15% 65%)`, gold gradient fill.

### 9.3 Slider (used by `gc-fov-slider`, `gc-volume-slider`, etc.)

- Track: 8px tall, dark inset, `1px solid var(--fg-gold-deep)`.
- Fill: gold gradient `linear-gradient(180deg, var(--fg-gold-bright), var(--fg-gold-deep))`.
- Handle: 14×14 square rotated 45° (diamond), gold gradient, `box-shadow: 0 0 0 1px #000, 0 0 6px rgba(232,200,120,0.5)`.
- Label row above (mono 10px, label left, `value{suffix}` right in `var(--fg-gold-bright)`).

### 9.4 Key cap (`gc-key`)

```css
display: inline-flex;
min-width: 22px; height: 22px;
padding: 0 6px;
font-family: var(--fg-mono);
font-size: 11px;
color: var(--fg-parch);
background: linear-gradient(180deg, #3a2a1c, #1a120a);
border: 1px solid var(--fg-gold-deep);
box-shadow: inset 0 1px 0 rgba(232,200,120,0.2), 0 1px 0 rgba(0,0,0,0.6);
```

---

## 10. Lists, Rows, Menu Items

### 10.1 `gc-list-row`

```css
padding: 10px 14px;
border-top: 1px solid rgba(201, 169, 97, 0.15);
display: flex; align-items: center; gap: 12px;
transition: background 0.15s ease;

:hover    background: rgba(201,169,97,0.08);
.is-selected {
  background: linear-gradient(90deg, rgba(201,169,97,0.18), transparent);
  box-shadow: inset 3px 0 0 var(--fg-gold);
}
```

### 10.2 `gc-menu-item`

```css
padding: 10px 14px;
font-family: var(--fg-display);
letter-spacing: 0.16em;
text-transform: uppercase;
font-size: 13px;
color: var(--fg-parch);                  /* selected: var(--fg-gold-bright) */
border-left: 2px solid transparent;      /* selected: 2px var(--fg-gold-bright) */
background: transparent;                 /* selected: linear-gradient(90deg, rgba(201,169,97,0.22), transparent 70%) */
display: flex; align-items: center; gap: 10px;
```

Selected state prefix glyph `◆` in `var(--fg-gold-bright)`. Hotkey rendered as `gc-key` on right.

### 10.3 Tab bar (`gc-tab-bar`)

```css
padding: 8px 14px (sm: 6px 12px);
font-family: var(--fg-display);
font-size: 11px (sm: 10px);
letter-spacing: 0.18em;
text-transform: uppercase;
color: var(--fg-parch-3);                /* active: var(--fg-gold-bright) */
background: transparent;                 /* active: rgba(201,169,97,0.12) */
border-bottom: 2px solid transparent;    /* active: 2px var(--fg-gold-bright) */
```

---

## 11. Badges, Chips, Pips

### 11.1 `gc-rarity-chip`

```css
font-family: var(--fg-mono);
font-size: 10px;
letter-spacing: 0.18em;
text-transform: uppercase;
color: var(--fg-{rarity});
border: 1px solid var(--fg-{rarity});
background: rgba(0,0,0,0.4);
padding: 2px 6px;
```

### 11.2 `gc-currency-chip` / `gc-currency-display`

Mono 13px, gold-bright color, glyph + `amount.toLocaleString()` separated by 4px gap.

### 11.3 `gc-icon-badge`

Square, size-driven, dark gradient bg `linear-gradient(180deg, #2a1f14, #0a0604)`, gold-deep border, top highlight inset, glyph at 0.5× size.

### 11.4 Status pip (`fg-pip`)

6×6 square, color via `--c` custom prop, glow `0 0 6px var(--c)`. Use for online/ready/buff pulse.

### 11.5 Buff icon (`gc-buff-icon`)

Square 36px (size-driven). Buff: bg `linear-gradient(135deg, #2a3a1a, #0a1006)`, border `var(--fg-stamina)`, glyph color `var(--fg-stamina-bright)`. Debuff: bg `linear-gradient(135deg, #3a1a14, #100604)`, border `var(--fg-blood)`, glyph color `var(--fg-blood-bright)`. Time label bottom-right, mono 10px, parch with text-shadow.

---

## 12. Portraits & Medallions (`gc-portrait`)

```css
width/height: 64px (default);
background: radial-gradient(70% 70% at 50% 30%, #6a4a2a, #2a1a0a 80%);
border: 2px solid var(--fg-gold-deep);
box-shadow:
  inset 0 0 0 1px var(--fg-gold-bright),
  inset 0 0 12px rgba(0,0,0,0.6),
  0 0 0 1px #000,
  0 4px 10px rgba(0,0,0,0.6);
font-family: var(--fg-display);
font-weight: 700;
color: var(--fg-gold-bright);
text-shadow: 0 1px 2px #000;

/* circle variant */
border-radius: 50%;
```

Level badge (when `level` prop): bottom-right offset `(-4, -4)`, min-width 22px / height 22px, padding `0 5px`, dark gradient bg, gold border, mono 11px gold-bright.

---

## 13. Tooltips, Dialogs, Modals

### 13.1 Item tooltip (`gc-item-tooltip`)

Panel-styled (gilded frame, optional rune corners). Header: item name in display caps colored by rarity (`var(--fg-{rarity})`). Body: mono stat rows + body italic flavor at bottom (`var(--fg-parch-3)`). Inner glow tinted by rarity at low opacity.

### 13.2 Dialog (`gc-confirm-dialog`, `gc-report-player-dialog`)

```css
background: linear-gradient(180deg, rgba(20,12,8,0.96), rgba(10,6,4,0.96));
border: 1px solid var(--fg-gold-deep);
box-shadow:
  inset 0 0 0 1px var(--fg-gold-shadow),
  0 20px 50px rgba(0,0,0,0.8);
padding: 30px 24px;
```

Required parts: eyebrow, title (display 26px, ls 0.12em, gold-bright), divider (diamond), message (body 14px), button row (right-aligned, primary/danger + ghost cancel).

### 13.3 Backdrop

Modal backdrop = `rgba(0,0,0,0.65)` + `backdrop-filter: blur(2px)` (optional). Z-index follows panel hierarchy: backdrop 1040, modal 1050, tooltip 1080.

---

## 14. Motion

| Use | Duration | Easing |
|---|---|---|
| Hover (button transform/filter) | `0.12s` | `ease` |
| Toggle / check / select highlight | `0.15s` | `ease` |
| Bar fill change | `0.4-0.6s` | `ease-out` |
| Bar ghost overlay | `0.6s` `0.25s` delay | `ease-out` |
| Modal/dialog enter | `0.2s` | `ease-out` |
| Letterbox bars | `0.4s` | `ease-in-out` |
| Floating combat text (`fg-float-up`) | 600-800ms | custom keyframe (translateY -60px, opacity 0→1→0, scale 1→1.1→0.9) |

No bouncy springs, no decorative micro-motion. Movement = direct + curt.

---

## 15. Spacing

Coarse scale (px). No design-token variables for spacing in fantasy theme — use these constants:

| Step | Value |
|---|---|
| xs | `2px` |
| sm | `4-6px` |
| md | `8-10px` |
| lg | `12-14px` |
| xl | `16-20px` |
| 2xl | `24-30px` |
| 3xl | `40-60px` (panel padding for hero menus) |

Panel padding default: `14-16px`. Dialog padding: `24-30px`. Hotbar/buff strip padding: `8-10px`. Row padding: `10px 14px`.

Gap between siblings: `4-6px` (chips), `8-12px` (controls), `16-24px` (sections).

---

## 16. Iconography

- **Glyphs over raster**: prefer Unicode (`✦ ◆ ◈ ❖ ☆ ☩ ⚔ 🛡 ❄ 🔥 ⚕ 🜍 ☠`) and Bootstrap Icons (`bi bi-*`) over bitmap art.
- **Compass / bar markers**: SVG inline.
- **Cooldowns / radial fills**: `conic-gradient` (no SVG dependency).
- **Diamonds / runes**: `clip-path` polygon on gradient div (no SVG).
- Icon color: inherit from container; for emphasis use `var(--fg-gold-bright)`; for danger use `var(--fg-blood-bright)`.

---

## 17. Layout Primitive Mapping

| Component spec | Implementation note |
|---|---|
| `gc-stack` | Flex with direction prop; gap from §15 scale; respects `align`/`justify`/`wrap`/`inline`. |
| `gc-grid` | CSS grid; `cellSize` → `grid-template-columns: repeat(columns, cellSize)`. |
| `gc-anchor` | Absolute-positioned region; `position` prop maps to `top/left/right/bottom`; `inset` numeric. |
| `gc-safe-area` | Padding inset for HUD edges; `extra` adds beyond `env(safe-area-inset-*)`. |
| `gc-aspect-ratio-box` | `aspect-ratio` CSS prop with fallback padding-bottom hack. |

---

## 18. Accessibility & Interaction

- All interactive `gc-*` (buttons, toggles, items, menu items, tabs) MUST have `:focus-visible` ring: `outline: 2px solid var(--fg-gold-bright)` + `outline-offset: 2px`. Outline hidden on mouse via `:focus:not(:focus-visible)`.
- Keyboard: Space/Enter activate; Esc closes overlays; Arrow keys navigate menu items (already noted in `gc-main-menu`).
- ARIA roles: dialog (`role=dialog aria-modal=true`), switch, checkbox already specified in component_specs.md — extend to `gc-tab-bar` (role=tablist), `gc-menu-item` (role=menuitem), `gc-list` (role=listbox/option).
- Color is never the sole carrier of state — pair with glyph (◆ for selected, lock icon for locked, ▲/▼ for trend, time label for cooldown).
- Min hit target: 32×32 (settings rows), 44×44 (mobile-class controls). Slot grids may go smaller (28-36px) on hotbars by design.

---

## 19. Component-Class Authoring Rules

When implementing a `gc-*` Lit component:

1. **Tokens only**: every color/border/shadow MUST use `var(--fg-*)` or the named gradients in §3-§13. Hex literals appear only inside gradient definitions matching this doc.
2. **Square by default**: do not introduce `border-radius` unless the component is explicitly a circle/diamond (`gc-portrait` circle, divider diamond, slider handle).
3. **Inset bevel stack required** on every framed surface (panel, slot, button, key cap, toggle): outer dark, optional gold ring, top highlight.
4. **Display caps on labels**: every component-level label/title uses `var(--fg-display)` + uppercase + ≥`0.16em` letter-spacing.
5. **Mono for numerals**: any numeric output (HP, qty, ping, FPS, score, currency, hotkey, version) uses `var(--fg-mono)`.
6. **Eyebrow + Title** (PanelHeader pattern) is the canonical header for any panel-shaped component.
7. **Divider with diamond** separates header from body in dialogs/menus.
8. **No raster, no bitmap fonts, no third-party CSS frameworks**. Use only `fantasy.css` tokens + component-local Shadow DOM CSS.
9. **Custom event emit**: keep `emit('change' | 'select' | 'click' | …)` shape from existing specs — do not introduce new event-name conventions.
10. **Reflected boolean props** (`open`, `selected`, `on`, `show`) must be used as CSS `:host([open])` selectors so external CSS can target state if needed.

---

## 20. Quick Reference — "What does fantasy mean?"

| Yes | No |
|---|---|
| Square corners | Rounded corners (except portrait circle, diamond) |
| Gold-deep borders | Bright primary blue/red borders |
| Display caps + wide tracking | Sentence-case sans-serif |
| Mono numerals | Display-font numerals |
| Inset bevel + top highlight | Flat fills |
| Dark wood + parchment | White card backgrounds |
| Diamond, rune corners, eyebrows | Material shadows, pill chips |
| `linear-gradient(180deg, …)` for fills | Solid single-color buttons |
| Conic-gradient cooldowns | Animated SVG spinners |
| Bootstrap Icons / Unicode glyphs | Custom raster sprites |

---

## 21. Source-of-Truth Files

- Tokens & base classes: `game_theme/fantasy.css`
- Primitive component patterns: `game_theme/fg-primitives.jsx`, `fg-atoms.jsx`
- Composition patterns (panels, menus): `game_theme/fg-menus.jsx`, `fg-hud.jsx`, `fg-inventory.jsx`, `fg-progression.jsx`
- HTML showcases (visual reference): `game_theme/Fantasy Game UI.html`, `Fantasy UI Library.html`

When `component_specs.md` introduces a new component, this doc is the visual contract — extend tokens here first, then bind in the component's Shadow DOM CSS.

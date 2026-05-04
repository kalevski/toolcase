# Existing game-components API

Reference for all components currently shipped in `game-components/src/`. Use to pick right primitive before scaffolding new one. Tag prefix `gc-*`. All extend `HTMLElement`, vanilla, Shadow DOM `mode: 'open'`.

Source of truth: `game-components/src/index.ts` exports. If component listed here missing from `index.ts`, treat doc as stale.

---

## Layout primitives

### `gc-stack` — `Stack`

Flex row/column with gap, align, justify, wrap.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` | maps to `flex-direction` |
| `gap` | string (CSS length) | `'0px'` | any CSS gap value (`8px`, `1rem`) |
| `align` | string | `'stretch'` | `align-items` value |
| `justify` | string | `'flex-start'` | `justify-content` value |
| `wrap` | boolean attr | absent | `flex-wrap: wrap` when present |
| `inline` | boolean attr | absent | `inline-flex` when present |

Slot: default. Children laid out as flex items.
Events: none.
Styling: applied via inline `style.*` on host. No SCSS surface.

**Use when:** stacking children vertically or horizontally with consistent gap. Default container for forms, menus, button groups, label rows.
**Skip when:** need 2D grid (use `gc-grid`), need absolute positioning (use `gc-anchor`).

---

### `gc-grid` — `Grid`

CSS grid with uniform cell size.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `columns` | string (count) | `''` | becomes `repeat(N, cellSize)` |
| `rows` | string (count) | `''` | becomes `repeat(N, cellSize)` |
| `gap` | string | `'0px'` | grid gap |
| `cell-size` / `cellSize` | string | `'1fr'` | track size for both axes |

Slot: default.
Events: none.

**Use when:** uniform cell layouts — inventory grid backdrop, hotbar cells, icon matrix, character select tiles.
**Skip when:** non-uniform tracks or named areas needed (use raw CSS grid).

---

### `gc-safe-area` — `SafeArea`

Padding inset that combines `env(safe-area-inset-*)` with optional extra padding. Sets only padding; does not change layout.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `extra` | string (CSS length) | `'0px'` | added on top of every `env(safe-area-inset-*)` value via CSS var |

Slot: default.
Events: none.

**Use when:** outer wrapper for HUD edges on phones/devices with notch/cutout safe areas. Sits above the actual HUD layer to push it away from the screen edges.
**Skip when:** desktop-only UI without safe-area concerns (use plain padding).

---

### `gc-aspect-ratio-box` — `AspectRatioBox`

Maintains a fixed aspect ratio. Modern `aspect-ratio` with `padding-bottom` fallback for older engines.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `ratio` | string (`'W / H'` or `'W:H'`) | `'16 / 9'` | sets `--gc-aspect-ratio`; numeric parts feed fallback `padding-bottom` percentage |

Slot: default. Children render inside an absolute-positioned `.gc-aspect-ratio-box-content` wrapper to fill the box.
Events: none.

**Use when:** video player, mini-map, character render preview, scoreboard widget — anywhere a fixed aspect ratio matters.
**Skip when:** the child already enforces its own dimensions (use plain `gc-stack`/`gc-grid`).

---

### `gc-anchor` — `Anchor`

Absolute-positioned child anchored to one of nine box positions. Sets `position: absolute` on host.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `position` | `AnchorPosition` | `'top-left'` | 9 values: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right` |
| `inset` | string (CSS length) | `'0px'` | distance from edge(s); ignored for `center` |

Type: `AnchorPosition` exported.
Slot: default.
Events: none.

**Use when:** parent has `position: relative` and child must pin to corner/edge — HUD overlays, version label in bottom corner, close button top-right.
**Skip when:** flow layout enough (use `gc-stack`).

---

## Containers

### `gc-panel` — `Panel`

Generic framed surface. Visual variants toggled via boolean attrs.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `bordered` | boolean attr | absent | gold border treatment |
| `corners` | boolean attr | absent | corner ornaments |
| `parchment` | boolean attr | absent | parchment fill variant |

Slot: default.
Events: none.
Styling: lives in `_panel.scss`.

**Use when:** any framed content block — settings groups, stat readouts, dialog body. Default container for grouped UI.
**Skip when:** want fixed gilded look without flag toggling (use `gc-gilded-frame`), or full-bleed scene background (use `gc-artboard-backdrop`).

---

### `gc-gilded-frame` — `GildedFrame`

Decorative gilded frame with tone variants. Defaults applied on connect.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `GildedFrameTone` = `'dark' \| 'leather' \| 'transparent'` | `'dark'` | background treatment |
| `padding` | `GildedFramePadding` = `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | inner padding scale |

Types: `GildedFrameTone`, `GildedFramePadding` exported.
Slot: default.
Events: none.

**Use when:** signature framed surface — main menu blocks, codex pages, character sheets, quest detail. Heavier ornament than `gc-panel`.
**Skip when:** lightweight grouping (use `gc-panel`), full-screen background (use `gc-artboard-backdrop`).

---

### `gc-artboard-backdrop` — `ArtboardBackdrop`

Full-canvas backdrop layer. Defaults applied on connect.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `kind` | `ArtboardBackdropKind` = `'dark' \| 'scene' \| 'parch'` | `'dark'` | surface treatment |
| `padding` | `ArtboardBackdropPadding` = `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | inner padding scale |

Types: `ArtboardBackdropKind`, `ArtboardBackdropPadding` exported.
Slot: default.
Events: none.

**Use when:** outermost screen layer — title screen, loading screen, pause overlay, demo storyboard. Sets the stage for nested panels.
**Skip when:** smaller framed block inside other content (use `gc-gilded-frame` or `gc-panel`).

---

## Typography

### `gc-title` — `Title`

Display title text with optional explicit pixel size.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | number (px) \| `null` | `null` | sets `--gc-title-size` CSS var on host when set |

Slot: default (text or inline children).
Events: none.

**Use when:** primary screen heading — main menu title, quest name, dialog title. Display caps + wide tracking enforced via SCSS.
**Skip when:** secondary heading (use `gc-subtitle`), label-of-section (use `gc-eyebrow`), body prose (use `gc-lore-text`).

---

### `gc-subtitle` — `Subtitle`

Two-line subtitle/dialogue line with optional speaker. Renders into light DOM (replaces own `innerHTML`).

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | string | `''` | main subtitle line |
| `speaker` | string | `''` | optional speaker name above text |
| `boxed` | boolean attr | absent | boxed background variant |
| `align` | `SubtitleAlign` = `'left' \| 'right' \| 'center'` | `'center'` | text alignment |
| `font-size` / `fontSize` | number (px) \| `null` | `null` | sets `--gc-subtitle-font-size` |
| `max-width` / `maxWidth` | number (px) \| `null` | `null` | sets `--gc-subtitle-max-width` |

Type: `SubtitleAlign` exported.
Slot: none (re-renders innerHTML each update). Escapes user text.
Events: none.

**Use when:** in-game dialogue subtitle, cinematic caption, speaker line. Anywhere text changes dynamically with optional speaker name.
**Skip when:** static heading (use `gc-title`), small uppercase tag (use `gc-eyebrow`).

---

### `gc-eyebrow` — `Eyebrow`

Small uppercase label rendered above titles or section headers.

API: slot-only. No attrs, no props, no events.

**Use when:** category tag above heading — "MAIN MENU", "SETTINGS · GRAPHICS", "CHAPTER 3". Pairs above `gc-title` or `gc-subtitle`.
**Skip when:** body text (use `gc-lore-text`).

---

### `gc-key` — `Key`

Inline keyboard/gamepad key glyph. Slot-only.

API: slot-only. No attrs, no props, no events.

**Use when:** rendering a single key prompt inline with text — "Press <gc-key>E</gc-key> to interact". For full bind-list use a future `gc-controls-rebind-list`.
**Skip when:** full keybinding row UI (use a higher-level component).

---

### `gc-lore-text` — `LoreText`

Body prose / lore paragraph block. Slot-only.

API: slot-only. No attrs, no props, no events.

**Use when:** flavor text, item description, codex paragraph, quest body. Apply when reading-length text needs lore styling (serif, drop-cap-ready surface).
**Skip when:** UI label (use `gc-eyebrow`), heading (use `gc-title`/`gc-subtitle`), dynamic dialogue line (use `gc-subtitle`).

---

### `gc-scroll-text` — `ScrollText`

Scroll/parchment block with optional decorated title row. Manipulates light DOM to inject a `[data-gc-scroll-title]` heading element.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `scroll-title` / `scrollTitle` | string | `''` | when set, inserts `✦ <title>` element as first child |

Slot: default (body content).
Events: none.

**Use when:** parchment-scroll passages — letters, edicts, prologue text, tutorial scroll. Title row gives ornamented top.
**Skip when:** plain prose without scroll motif (use `gc-lore-text`).

---

### `gc-version-label` — `VersionLabel`

Version / build / branch label. Renders into light DOM with HTML-escaped values, separator dots between non-empty parts.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `version` | string | `''` | rendered as `v<version>` |
| `build` | string | `''` | rendered as `build <build>` |
| `branch` | string | `''` | rendered raw |

Slot: none (re-renders innerHTML).
Events: none.
Output classes: `gc-version-label-version`, `gc-version-label-build`, `gc-version-label-branch`, `gc-version-label-sep`.

**Use when:** corner build label on title/loading/pause screen. Combine with `gc-anchor position="bottom-right"`.
**Skip when:** generic key=value display (use plain text or `gc-stat-row` once available).

---

## Visual Indicators & Badges

### `gc-icon-badge` — `IconBadge`

Square gilded badge holding a single Unicode glyph or Bootstrap Icon.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `glyph` | string | `''` | Unicode char or `bi-*` / `bi bi-*` class |
| `size` | number (px) | `28` | sets host width/height + glyph font-size (~0.5×) |
| `color` | string (CSS color) | `var(--fg-gold-bright)` | glyph color override |
| `bg` | string (CSS background) | dark gradient | host background override |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** small framed glyph badge — header chip icon, status marker, decorative slot fill.
**Skip when:** rarity-coded chip (use `gc-rarity-chip`), currency readout (use `gc-currency-chip`/`gc-currency-display`), full slot with quantity/cooldown (future `gc-item-slot`).

---

### `gc-rarity-chip` — `RarityChip`

Mono uppercase chip colored by item rarity.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `rarity` | `ItemRarity` = `'common' \| 'uncommon' \| 'rare' \| 'epic' \| 'legendary' \| 'mythic'` | `'common'` | drives border + text color |

Type: `ItemRarity` exported.
Slot: none (re-renders innerHTML with rarity label).
Events: none.

**Use when:** tagging an item with its rarity in a tooltip header, list row, or grid cell.
**Skip when:** generic colored badge (use `gc-icon-badge` with custom color).

---

### `gc-currency-chip` — `CurrencyChip`

Inline currency: glyph + numeric amount in mono.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `glyph` | string | `''` | currency glyph (`◈`, `✦`, `❖`, …) |
| `amount` | number | `0` | rendered via `toLocaleString()` |
| `color` | string (CSS color) | `var(--fg-gold-bright)` | glyph + amount color |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** inline currency reference in a list/row/tooltip — "Price ◈ 1,200".
**Skip when:** HUD-scale currency display with optional eyebrow label (use `gc-currency-display`).

---

### `gc-currency-display` — `CurrencyDisplay`

HUD-scale currency readout with optional eyebrow label.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `amount` | number | `0` | rendered via `toLocaleString()` |
| `currency-icon` / `currencyIcon` | string | `''` | glyph rendered before amount |
| `label` | string | `''` | optional eyebrow caps label rendered before glyph |
| `color` | string (CSS color) | `var(--fg-gold-bright)` | glyph + amount color |
| `font-size` / `fontSize` | number (px) | `18` | glyph + amount font size |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** HUD currency readout — top bar "Gold ◈ 12,450", shop totals.
**Skip when:** small inline reference (use `gc-currency-chip`).

---

### `gc-portrait` — `Portrait`

Character medallion with optional level badge. Square or circle.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `glyph` | string | `''` | initial / icon centered in medallion |
| `size` | number (px) | `64` | host width/height; glyph ≈ 0.45× |
| `ring` | string (CSS color) | `var(--fg-gold-bright)` | inner ring color |
| `level` | number \| `null` | `null` | when set, renders bottom-right level badge |
| `circle` | boolean attr | absent | `border-radius: 50%` |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** party member avatar, character select card, dialogue speaker portrait.
**Skip when:** generic icon badge (use `gc-icon-badge`).

---

### `gc-platform-icon` — `PlatformIcon`

Platform glyph with optional uppercase label.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `platform` | `Platform` = `'pc' \| 'playstation' \| 'xbox' \| 'nintendo' \| 'steam' \| 'mobile' \| 'web'` | `'pc'` | drives glyph + color |
| `size` | number (px) | `16` | glyph size |
| `label` | boolean attr | absent | renders platform name in eyebrow caps |

Type: `Platform` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** cross-play badge, friends list platform marker, build target tag.
**Skip when:** generic glyph badge (use `gc-icon-badge`).

---

### `gc-gamepad-button-prompt` — `GamepadButtonPrompt`

Round button glyph (color-coded ABXY / shoulder) + optional action label.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `glyph` | string | `''` | `A`/`B`/`X`/`Y`/`LB`/`RB`/`LT`/`RT`; sets `data-button` for color |
| `label` | string | `''` | optional action label rendered after glyph |
| `size` | number (px) | `24` | host glyph diameter; text ~0.6× |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** in-world action prompt — "Press <gc-gamepad-button-prompt glyph='A' label='Confirm'/>".
**Skip when:** keyboard-only prompt (use `gc-key`).

---

### `gc-compass-rose` — `CompassRose`

Cardinal compass face with rotating needle (red north, parch south).

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `heading` | number (degrees) | `0` | rotates needle via CSS var |
| `size` | number (px) | `64` | host width/height |

Slot: none (re-renders SVG).
Events: none.

**Use when:** mini-map overlay, exploration HUD heading indicator.
**Skip when:** non-rotating directional glyph (use `gc-icon-badge` with arrow glyph).

---

### `gc-rune-corner` — `RuneCorner`

Decorative gilded corner glyph absolutely positioned inside a `position: relative` parent.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `at` | `RuneCornerPosition` = `'tl' \| 'tr' \| 'bl' \| 'br'` | `'tl'` | corner position + transform variant |
| `size` | number (px) | `14` | side length of the notch glyph |

Type: `RuneCornerPosition` exported.
Slot: none.
Events: none.

**Use when:** adding rune corners to a custom framed container that is not `gc-panel[corners]`.
**Skip when:** standard panel signature corners (use `gc-panel corners`).

---

### `gc-buff-icon` — `BuffIcon`

Square buff/debuff icon with bottom-right time label. Buff = stamina-green palette; debuff = blood-red palette.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `glyph` | string | `''` | Unicode char or `bi-*` / `bi bi-*` class |
| `time` | string | `''` | optional bottom-right label (e.g. `'9s'`) |
| `kind` | `'buff' \| 'debuff'` | `'buff'` | drives palette |
| `color` | string (CSS color) | `''` | override glyph color |
| `size` | number (px) | `36` | host width/height; glyph ~0.5× |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** single status pip on a portrait or row.
**Skip when:** full active-buff bar (use `gc-buff-bar`).

---

### `gc-buff-bar` — `BuffBar`

Inline row of buff icons with optional cooldown conic-gradient overlay and stack count.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `icon-size` / `iconSize` | number (px) | `36` | per-cell glyph size |
| `gap` | string (CSS length) | `'6px'` | spacing between cells |
| `buffs` (prop only) | `BuffEntry[]` | `[]` | `{ id, icon?, name?, remaining?, duration?, stacks?, debuff? }` |

Type: `BuffEntry` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** active buffs/debuffs HUD strip on player frame.
**Skip when:** static legend/codex of buffs (use `gc-codex`).

---

### `gc-ping-display` — `PingDisplay`

Network latency readout with color-coded pip + value.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `ping` | number \| `null` | `null` | `null` → em-dash; tier via `data-tier` (success <60, warning <200, danger ≥200) |

Type: `PingTier` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** server browser row, in-game HUD net status.
**Skip when:** generic colored chip (use `gc-icon-badge`).

---

### `gc-page-indicator` — `PageIndicator`

Diamond-shaped page dots, click/keyboard activatable.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `count` | number | `0` | total page count |
| `index` | number | `0` | active page (0-based) |
| `size` | number (px) | `8` | dot side length |
| `gap` | string (CSS length) | `8px` | gap between dots |
| `color` | string (CSS color) | `var(--fg-gold-deep)` | inactive dot color |
| `active-color` / `activeColor` | string (CSS color) | `var(--fg-gold-bright)` | active dot color |

Slot: none (re-renders innerHTML).
Events: `select` → `CustomEvent<{ index: number }>` (bubbles, composed).
Accessibility: each dot is a `<button>` with `aria-label="Page N"` and `aria-current="page"` on the active dot.

**Use when:** carousel pagination, multi-page settings tabs, screen indicator dots.
**Skip when:** named tabs (use `gc-tab-bar` once available).

---

### `gc-divider` — `Divider`

Horizontal gold-gradient rule with optional centered diamond ornament. Per §5 of the style guide.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `no-diamond` / `noDiamond` | boolean attr | absent | omits the centered 8×8 rotated diamond |

Slot: none (re-renders innerHTML).
Events: none.
Accessibility: `role="separator"` set on connect.

**Use when:** standalone section break inside a panel, dialog, menu, or screen — anywhere a header/body or body/footer split needs the signature gold rule + diamond.
**Skip when:** the divider is part of a header (use `gc-panel-header`, which already includes one).

---

## Buttons & Navigation

### `gc-metal-button` — `MetalButton`

Gilded fantasy button with variant + size scales. Host element renders as the button; slot holds the label content.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `MetalButtonVariant` = `'default' \| 'primary' \| 'danger' \| 'ghost'` | `'default'` | drives background gradient + border + label color |
| `size` | `MetalButtonSize` = `'sm' \| 'md' \| 'lg'` | `'md'` | sets padding + font-size per §6.2 |
| `disabled` | boolean attr | absent | dims, removes pointer events; suppresses click + Enter/Space |

Types: `MetalButtonVariant`, `MetalButtonSize` exported.
Slot: default (label content — text or inline children).
Events: native `click` (host element). Enter/Space activates via `el.click()`.
Accessibility: `role="button"`, `tabindex="0"` (removed when disabled), `aria-disabled` on disabled, `:focus-visible` ring.

**Use when:** any primary CTA / dialog action / menu confirm. Default action button for fantasy UI.
**Skip when:** square icon-only nav (use `gc-nav-button`), in-list selection row (use `gc-list-row`), menu list entry (use `gc-menu-item`).

---

### `gc-nav-button` — `NavButton`

Square gilded icon button for back / close affordances. Renders glyph into light DOM via `innerHTML`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `kind` | `NavButtonKind` = `'back' \| 'close'` | `'back'` | drives glyph (`←` / `✕`) and default aria-label |
| `label` | string | `''` | overrides default aria-label |
| `size` | number (px) \| `null` | `null` | sets `--gc-nav-button-size` (default 36) |

Type: `NavButtonKind` exported.
Slot: none (re-renders innerHTML).
Events: native `click`. Enter/Space activates.
Accessibility: `role="button"`, `tabindex="0"`, auto `aria-label` (`Back` / `Close`) when `label` not set, `:focus-visible` ring.

**Use when:** dialog close button, back arrow on a sub-screen, modal dismiss.
**Skip when:** labeled action button (use `gc-metal-button`), generic icon badge without click (use `gc-icon-badge`).

---

### `gc-menu-item` — `MenuItem`

Menu list row with caret indicator on selected, optional icon and hotkey. Renders content into light DOM.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | `''` | uppercase display caps via §10.2 |
| `hotkey` | string | `''` | rendered as inline `gc-key` on right when set |
| `icon` | string | `''` | Unicode glyph or `bi-*` / `bi bi-*` class; rendered before label |
| `selected` | boolean attr (reflected) | absent | adds `◆` caret prefix + gold accent + 2px gold left border |
| `disabled` | boolean attr | absent | dims, removes pointer events; suppresses click + Enter/Space |

Slot: none (re-renders innerHTML on every attribute change). Escapes user text.
Events: `select` → `CustomEvent<{ label: string }>` (bubbles, composed) on click / Enter / Space.
Accessibility: `role="menuitem"`, `tabindex="0"` (removed when disabled), `aria-current="true"` when selected, `aria-disabled` when disabled, `:focus-visible` ring.

**Use when:** main-menu rows, pause-menu rows, settings-category list, dropdown items. Composes inside `gc-panel[bordered]`.
**Skip when:** generic selectable row with arbitrary children (use `gc-list-row`), styled CTA button (use `gc-metal-button`).

---

### `gc-list-row` — `ListRow`

Generic selectable row with hover/selected states and optional accent stripe. Children flow through default slot.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `selected` | boolean attr (reflected) | absent | adds gold gradient highlight + 3px inset left stripe |
| `accent` | string (CSS color) | `''` | sets `--gc-list-row-accent`; controls left-stripe color when selected (default `var(--fg-gold)`) |

Slot: default. Place item children directly inside.
Events: `select` → `CustomEvent<void>` (bubbles, composed) on click / Enter / Space.
Accessibility: `role="option"`, `tabindex="0"`, `aria-selected` toggled with `selected`, `:focus-visible` ring.

**Use when:** server browser, inventory list, save slots, friends list — any data row with arbitrary inner layout.
**Skip when:** uniform menu list (use `gc-menu-item`), labeled CTA (use `gc-metal-button`).

---

### `gc-tab-bar` — `TabBar`

Horizontal tab strip with active underline + gold tint.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `active-id` / `activeId` | string | `''` | currently-active tab id |
| `size` | `TabBarSize` = `'sm' \| 'md'` | `'md'` | `sm` shrinks padding + font size |
| `tabs` (prop only) | `TabItem[] = { id, label, icon? }[]` | `[]` | populate via property |

Type: `TabBarSize`, `TabItem` exported.
Slot: none (re-renders innerHTML).
Events: `change` → `CustomEvent<{ id: string }>` (bubbles, composed) when a different tab is clicked.
Accessibility: host `role="tablist"`; each tab is a `<button role="tab">` with `aria-selected` and `tabindex` 0/-1 by active state.

**Use when:** sub-tabs inside a settings panel, codex page nav, character sheet tabs.
**Skip when:** sidebar-style nav (use `gc-settings-category-list`), full-screen menu list (use `gc-main-menu`).

---

## Lists & Selection (compound)

### `gc-pause-menu` — `PauseMenu`

Modal pause overlay with eyebrow + title + diamond divider + items list + Resume CTA. Closes on Esc or backdrop click.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | boolean attr (reflected) | absent | drives visibility (`display: none` when not set); registers Esc listener at all times, only acts when open |
| `menu-title` / `menuTitle` | string | `'Paused'` | shown as `gc-title` in the header |
| `items` (prop only) | `PauseMenuItem[] = { id, label, disabled?, badge? }[]` | `[]` | populate via property |

Type: `PauseMenuItem` exported.
Slot: none (re-renders innerHTML).
Events: `resume` → `void` (Resume button), `close` → `void` (Esc / backdrop click), `select` → `{ id: string }` (item click).
Accessibility: `role="dialog"`, `aria-modal="true"`. Items have `role="menuitem"`, `tabindex` 0/-1, `aria-disabled` on disabled.

**Use when:** in-game pause overlay. Composes a `gc-metal-button` for the Resume CTA inside its panel.
**Skip when:** main-menu list (use `gc-main-menu`), settings sidebar (use `gc-settings-category-list`).

---

### `gc-main-menu` — `MainMenu`

Title-screen menu list with eyebrow + display title + subtitle header and arrow-key navigation between items. Selected row gets `◆` caret + gold accent + 2px gold left stripe.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `selected-id` / `selectedId` | string | `''` | currently-highlighted item id; arrow keys + hover update it |
| `menu-title` / `menuTitle` | string | `''` | shown as `gc-title` |
| `subtitle` | string | `''` | italic body line under the title |
| `items` (prop only) | `MainMenuItem[] = { id, label, disabled?, badge? }[]` | `[]` | populate via property |

Type: `MainMenuItem` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{ id: string }` on click / Enter / Space (when an enabled item is selected).
Accessibility: host `role="menu"`, `tabindex="0"`. Items have `role="menuitem"`, `aria-current` on selected, `aria-disabled` on disabled.

**Use when:** title screen primary navigation, in-game radial menu list.
**Skip when:** settings nav (use `gc-settings-category-list`), generic data row list (use `gc-list`).

---

### `gc-list` — `GcList`

Generic selectable list (icon + label + meta cell). Single-select via `selected-id`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `selected-id` / `selectedId` | string | `''` | currently-selected item id |
| `items` (prop only) | `GcListItem[] = { id, label?, icon?, meta?, disabled? }[]` | `[]` | populate via property |

Type: `GcListItem` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{ id: string }` on click / Enter / Space (when enabled).
Accessibility: host `role="listbox"`. Items have `role="option"`, `tabindex` 0/-1, `aria-selected`, `aria-disabled` when disabled.

**Use when:** uniform data list (inventory, chapters, characters) where each row has icon + label + optional right-side meta.
**Skip when:** rich row layout with arbitrary children (use `gc-list-row`), uniform menu items (use `gc-menu-item`).

---

### `gc-settings-category-list` — `SettingsCategoryList`

Two-column settings layout: left sidebar of categories, right slotted content area. Selected category highlights gold; consumer's children render in the body container.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `selected-id` / `selectedId` | string | `''` | active category id |
| `categories` (prop only) | `SettingsCategory[] = { id, label, icon? }[]` | `[]` | populate via property |

Type: `SettingsCategory` exported.
Slot: default (consumer children land in `.gc-settings-category-list-body`). Existing children are preserved on first connect — subsequent re-renders only touch the nav side.
Events: `select` → `{ id: string }` on category click.
Accessibility: nav has `role="tablist"`; category buttons are `role="tab"` with `aria-selected` + `aria-current`. Body is `role="tabpanel"`.

**Use when:** settings screen with vertical category nav + content area on the right.
**Skip when:** horizontal tab bar (use `gc-tab-bar`), no-content sidebar (use `gc-list`).

---

### `gc-combo-box` — `ComboBox`

Searchable single-select dropdown. Click button to open; type to filter by label/value/keywords; click option to commit. Outside-click and Esc close. Disabled prop blocks all interaction.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | string | `''` | currently-selected option value |
| `placeholder` | string | `'Select…'` | shown when no option is selected |
| `disabled` | boolean attr | absent | dims, blocks open + interaction |
| `options` (prop only) | `ComboOption[] = { value, label, keywords? }[]` | `[]` | populate via property |

Type: `ComboOption` exported.
Slot: none (re-renders innerHTML).
Events: `change` → `{ value: string }` on option select.
Accessibility: host `role="combobox"`; trigger is a `<button>` with `aria-haspopup="listbox"` + `aria-expanded`. Options have `role="option"` + `aria-selected`.

**Use when:** key/value picker with many options that benefit from a search filter (race / class / region / preset).
**Skip when:** small fixed list (use `gc-select-row`), full menu list (use `gc-main-menu` / `gc-list`).

---

## Dialogs & Modals

### `gc-dialogue-box` — `DialogueBox`

In-world dialogue with typing animation, optional speaker name, and either click-to-advance indicator or choice list. Click during typing skips to full text; click after typing emits `advance` (when no choices).

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `speaker` | string | `''` | optional speaker name above text |
| `text` | string | `''` | dialogue body; setting it restarts typing animation |
| `typing-speed` / `typingSpeed` | number (chars/sec) | `24` | clamped at min interval 8ms |
| `choices` (prop only) | `DialogueChoice[] = { id, label, disabled? }[]` | `[]` | when set + length > 0, replaces advance indicator |

Type: `DialogueChoice` exported.
Slot: none (re-renders innerHTML).
Events: `advance` → `void` on click after typing finishes (only when no choices). `choice` → `{ id: string }` when a choice is activated.
Accessibility: host `role="group"`. Choices are `role="button"` with `tabindex` 0/-1 and `aria-disabled` on disabled.

**Use when:** NPC dialogue scene, cinematic reveal with typed text, branching choice prompt.
**Skip when:** simple subtitle line (use `gc-subtitle`), modal confirmation (use a future `gc-confirm-dialog`).

---

### `gc-report-player-dialog` — `ReportPlayerDialog`

Player report submission modal: eyebrow + player name + divider + reason radio group + optional comment textarea + Cancel/Submit row. Esc + backdrop click emit `cancel`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | boolean attr (reflected) | absent | drives visibility |
| `player-name` / `playerName` | string | `''` | shown as `gc-title` |
| `reasons` (prop only) | `string[]` | 5 default reasons | falsy/empty array falls back to defaults |

Slot: none (re-renders innerHTML).
Events: `cancel` → `void` (Cancel button / backdrop / Esc), `submit` → `{ reason: string, comment: string }` (only when a reason is selected).
Accessibility: `role="dialog"`, `aria-modal="true"`. Radio group is `role="radiogroup"` with native `<input type="radio">` (visually hidden behind a custom square radio glyph).

**Use when:** in-game player report flow where the user picks one reason + optional free-form comment.
**Skip when:** generic confirm/destructive prompt (use a future `gc-confirm-dialog`).

---

### `gc-invite-toast` — `InviteToast`

Top-right party invite toast with gilded panel, eyebrow + countdown header, inviter + body, drain bar, Decline/Accept actions. Auto-emits `decline` when timer reaches 0.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | boolean attr (reflected) | absent | drives visibility + starts/stops countdown |
| `inviter` | string | `''` | display caps inviter name |
| `body` | string | `''` | italic body line |
| `timeout-seconds` / `timeoutSeconds` | number (s) | `15` | re-arms countdown when set/changed while open |

Slot: none (re-renders innerHTML).
Events: `accept` → `void` (Accept button), `decline` → `void` (Decline button OR auto-fires when countdown reaches 0).
Position: `position: fixed; top: 16px; right: 16px; z-index: 1080`.

**Use when:** non-blocking incoming invite/notification with a hard deadline (party invite, duel request, trade request).
**Skip when:** blocking confirmation (use `gc-report-player-dialog` shape or future `gc-confirm-dialog`).

---

### `gc-legal-screen` — `LegalScreen`

Multi-section legal viewer: title bar with close button, sidebar of section titles, body area with eyebrow + section title + scrollable body, optional Accept footer.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `initial-section` / `initialSection` | string | `''` | id of the section to highlight on first render; falls back to first section |
| `screen-title` / `screenTitle` | string | `'Legal'` | shown as `gc-title` |
| `show-accept` / `showAccept` | boolean attr | absent | renders the Accept primary button in the footer when set |
| `sections` (prop only) | `LegalSection[] = { id, title, body }[]` | `[]` | populate via property |

Type: `LegalSection` exported.
Slot: none (re-renders innerHTML).
Events: `close` → `void` (close button), `accept` → `void` (only when `show-accept`).
Accessibility: host `role="region"`. Close uses `gc-nav-button kind="close"`. Body container scrolls with `overflow-y: auto; max-height: 60vh`.

**Use when:** Terms / Privacy / EULA / open-source notices viewer with a sidebar nav and optional Accept gate.
**Skip when:** single-passage scroll text (use `gc-scroll-text`), modal confirm (use a future `gc-confirm-dialog`).

---

## Progress & Status

### `gc-circular-progress` — `CircularProgress`

SVG ring progress with optional center percentage text.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number | `0` | clamped to `[0, max]` |
| `max` | number | `100` | divisor for fill fraction |
| `size` | number (px) | `64` | host width/height + svg size |
| `thickness` | number (px) | `6` | stroke-width of both ring and fill |
| `color` | string (CSS color) | `var(--fg-gold-bright)` | fill stroke color |
| `background` | string (CSS color) | `var(--fg-gold-shadow)` | track stroke color |
| `show-text` / `showText` | boolean attr | absent | renders centered `${pct}%` mono label |
| `reverse` | boolean attr | absent | mirrors sweep direction (CCW) — useful for cooldown visual |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** ability cooldown ring, mini health/mana ring, loading progress, capture/objective fill.
**Skip when:** linear bar (use `gc-resource-bar-base` once available).

---

### `gc-cooldown-badge` — `CooldownBadge`

Item-slot-styled circular cooldown badge (32–64px). Uses a conic-gradient sweep over a slot-bevelled background, plus optional mono center label that auto-formats remaining time. Drops the dark sweep and adds a gold ready-glow once the cooldown finishes.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number | `0` | time remaining (or any unit); clamped to `[0, max]` |
| `max` | number | `1` | total duration; cleared if `<= 0` |
| `size` | number (px) | `48` | clamped to `[32, 64]` |
| `label` | string | `''` | static center text; if set, overrides auto-formatted countdown |
| `show-label` / `showLabel` | boolean attr | absent | enables auto-formatted countdown when no `label` is set |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** cooldown overlay on top of `gc-item-slot`, ability bar pulse beside `gc-ability-card`, generic timed-effect ring (≤ 64px).
**Skip when:** large radial progress (use `gc-circular-progress`), or non-timed percent fills.

---

### `gc-hit-marker` — `HitMarker`

FPS-style 4-corner crosshair X marker. Auto-hides after `duration` and emits `done`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `show` | boolean attr (reflected) | absent | when set, marker is visible; auto-cleared when timer fires |
| `crit` | boolean attr | absent | red bright + glow stroke |
| `kill` | boolean attr | absent | dark blood stroke + skull glyph overlay |
| `size` | number (px) | `24` | host width/height |
| `duration` | number (ms) | `350` | auto-hide delay; setting `show` resets the timer |

Slot: none (re-renders innerHTML).
Events: `done` → `CustomEvent<void>` (bubbles, composed) when auto-hide fires.

**Use when:** crosshair feedback for confirmed hits in shooters / arena games.
**Skip when:** floating numeric damage feedback (use `gc-damage-number`).

---

### `gc-damage-number` — `DamageNumber`

Floating combat text that animates upward + fades, then emits `done`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | string | `''` | text/number rendered as-is (pre-format with `toLocaleString` if needed) |
| `crit` | boolean attr | absent | larger blood-bright bold variant |
| `heal` | boolean attr | absent | stamina-bright with leading `+` prefix |
| `miss` | boolean attr | absent | display-italic `MISS` (overrides `value`) |
| `duration` | number (ms) | `700` | total animation length + delay before `done` emit |

Slot: none (re-renders innerHTML).
Events: `done` → `CustomEvent<void>` (bubbles, composed) once `duration` ms after connect; consumer typically removes the element.

**Use when:** popping damage / heal / miss text over an actor in combat.
**Skip when:** static stat readout (use `gc-currency-chip` or plain mono span).

---

### `gc-network-status-icon` — `NetworkStatusIcon`

4-bar wifi-style indicator with quality coloring derived from ping + loss + connected.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `ping` | number (ms) \| `null` | `null` | quality input; `null` → treated as 999 |
| `loss` | number (%) | `0` | packet-loss percentage; high loss downgrades tier independent of ping |
| `connected` | boolean attr | absent | when absent, tier is forced to `offline` (0 bars) |
| `size` | number (px) | `16` | bar group height |
| `show-label` / `showLabel` | boolean attr | absent | renders eyebrow caps label (`OFFLINE`, `24 ms`, …) |

Type: `NetworkStatusTier` = `'offline' \| 'bad' \| 'warning' \| 'ok' \| 'good'` exported. Tiers from `data-tier` on host. Thresholds (assumes `connected`): `offline` (no `connected`), `bad` (ping≥200 or loss≥5), `warning` (ping≥120 or loss≥3), `ok` (ping≥60 or loss≥1), `good` otherwise.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** in-game HUD net status, server browser quality marker, friends-list connection icon.
**Skip when:** raw latency value only (use `gc-ping-display`).

---

### `gc-combo-counter` — `ComboCounter`

Combo readout (eyebrow + mono `xN` value) with optional countdown timer bar. Hidden when `combo ≤ 1`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `combo` | number (int) | `0` | hidden when `<= 1` |
| `label` | string | `'Combo'` | eyebrow caps label |
| `timer` | number (0..1) \| `null` | `null` | timer bar visible when set; clamped to `[0, 1]` |
| `font-size` / `fontSize` | number (px) | `36` | mono number size |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** action-game combo readout that ramps from 2x upward with countdown drain.
**Skip when:** static score/multiplier (use `gc-score-display`).

---

### `gc-score-display` — `ScoreDisplay`

Score value with optional eyebrow label and multiplier badge.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `score` | number | `0` | rendered via `toLocaleString()` |
| `multiplier` | number \| `null` | `null` | badge rendered when not `null` and not `1` |
| `label` | string | `''` | eyebrow caps label above the row |
| `align` | `ScoreDisplayAlign` = `'left' \| 'right' \| 'center'` | `'left'` | drives flex alignment + text-align |
| `font-size` / `fontSize` | number (px) | `28` | mono score size; multiplier scales to ~0.55× |

Type: `ScoreDisplayAlign` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** HUD score readout, end-of-round score panel, leaderboard cell with current multiplier.
**Skip when:** combo display with countdown drain (use `gc-combo-counter`).

---

## Overlays & Effects

### `gc-screen-flash` — `ScreenFlash`

Full-viewport flash overlay. Fires when `trigger` attribute changes, fades over `duration`, then emits `done`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `flash-color` / `flashColor` | string (CSS color) | `'#ffffff'` | fill color |
| `flash-opacity` / `flashOpacity` | number (0..1) | `1` | starting opacity, clamped |
| `duration` | number (ms) | `200` | fade-out duration |
| `trigger` | string \| `null` | `null` | any change in this value re-fires the flash |

Slot: none.
Events: `done` → `CustomEvent<void>` (bubbles, composed) when fade completes.
Position: `position: fixed; inset: 0; z-index: 1090; pointer-events: none`.

**Use when:** screen-wide hit/damage/heal flash, camera-shutter feedback, screen-fill cinematic punch.
**Skip when:** localized hit feedback (use `gc-hit-marker`/`gc-damage-number`), full-scene transition (use `gc-transition-wipe`).

---

### `gc-shake-container` — `ShakeContainer`

Wraps children and applies a rAF-driven randomized translate offset when the `trigger` attribute changes. Intensity decays linearly over `duration`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `trigger` | string \| `null` | `null` | any change re-runs the shake |
| `intensity` | number (px) | `8` | starting max offset (decays to 0) |
| `duration` | number (ms) | `350` | total shake length |

Slot: default. Children receive the transform.
Events: none.

**Use when:** camera-shake feedback on damage/explosion/critical, panel bump on UI confirm.
**Skip when:** screen-wide flash (use `gc-screen-flash`), CSS-keyframe-only wiggle on a single element.

---

### `gc-transition-wipe` — `TransitionWipe`

Full-screen scene-transition wipe. Toggling `show` runs a CSS transition in the chosen direction; emits `complete` after `duration` ms.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `show` | boolean attr (reflected) | absent | drives wipe in (cover) when set |
| `direction` | `TransitionWipeDirection` = `'fade' \| 'left' \| 'right' \| 'up' \| 'down' \| 'iris'` | `'fade'` | wipe geometry |
| `duration` | number (ms) | `400` | animation length + delay before `complete` |
| `wipe-color` / `wipeColor` | string (CSS color) | `'#0a0604'` | fill color |

Type: `TransitionWipeDirection` exported.
Slot: none.
Events: `complete` → `CustomEvent<void>` (bubbles, composed) once `duration` ms after `show` set.

**Use when:** scene change, level-load curtain, fade-to-black before result screen.
**Skip when:** localized flash (use `gc-screen-flash`), modal backdrop (use `gc-confirm-dialog` + backdrop styling).

---

### `gc-interact-prompt` — `InteractPrompt`

In-world interact prompt — key glyph + uppercase text with optional hold-progress fill bar.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `show` | boolean attr | absent | hides when not set (`display: none`) |
| `key-label` / `keyLabel` | string | `''` | rendered as inline `gc-key` glyph |
| `text` | string | `''` | display caps action label |
| `hold-progress` / `holdProgress` | number (0..1) \| `null` | `null` | when set, renders hold-fill bar at fraction |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** "Press E to interact" / "Hold F to revive" world prompts on contextual triggers.
**Skip when:** keyboard binding list (use `gc-controls-rebind-list`), generic dialog action row (use `gc-metal-button`).

---

## Resource Bars

### `gc-health-bar`, `gc-mana-bar`, `gc-stamina-bar` — `HealthBar` / `ManaBar` / `StaminaBar` (extend `ResourceBarBase`)

Linear progress bars sharing `ResourceBarBase`. Each variant sets its own color triple (HP red, MP blue, stamina green) and default height per §1.6 / §8 of style_guidelines.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number | `0` | clamped to `[0, max]` |
| `max` | number | `100` | divisor for fill fraction |
| `ghost` | number \| `null` | `null` | when set and `>value`, renders trailing ghost overlay |
| `segments` | number | `1` | when `>1`, renders evenly-spaced 1px black dividers |
| `show-text` / `showText` | boolean attr | absent | renders centered `value / max` mono inline text (suppressed when `label` set) |
| `label` | string | `''` | when set, renders mono micro-label row above bar with right-aligned `value / max` |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** any HP / MP / stamina HUD bar.
**Skip when:** ammo block (use `gc-ammo-counter`), boss bar with phase ticks (use `gc-boss-bar`), ring progress (use `gc-circular-progress`).

---

### `gc-ammo-counter` — `AmmoCounter`

Framed weapon ammo readout: weapon name + `mag / magMax` + `+reserve`. Goes red when `mag < 20%` of `magMax`; dims with reload label when `reloading`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `mag` | number (int) | `0` | current magazine count |
| `mag-max` / `magMax` | number (int) | `30` | magazine capacity |
| `reserve` | number (int) | `0` | reserve ammo pool |
| `weapon-name` / `weaponName` | string | `''` | optional eyebrow caps weapon label |
| `reloading` | boolean attr | absent | dims primary count + shows "Reloading…" |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** shooter HUD ammo block.
**Skip when:** generic countdown/qty (use `gc-currency-display`).

---

### `gc-boss-bar` — `BossBar`

Wide centered boss HP bar with name, epithet, phase indicator and phase-tick notches.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | string | `''` | display caps boss name |
| `epithet` | string | `''` | optional italic body epithet |
| `phase` | number | `1` | mono "Phase N" label |
| `hp` | number | `0` | current HP |
| `hp-max` / `hpMax` | number | `100` | max HP |
| `phaseTicks` (prop only) | `number[]` | `[]` | array of `0..1` fractions; rendered as gold notches |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** raid/boss HP overlay top-of-screen.
**Skip when:** player HP (use `gc-health-bar`), structured stats panel (use `gc-stats-screen`).

---

## Settings rows

All settings rows extend `SettingRowBase` (abstract — no tag). Common attrs: `row-label` / `rowLabel`, `description`. Each subclass renders a control on the right and emits a `change` event with control-specific detail. Compose inside `gc-panel[bordered]` for a settings list.

### `gc-fov-slider` — `FOVSlider`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number (deg) | `90` | current FOV |
| `min` | number | `60` | min FOV |
| `max` | number | `120` | max FOV |

Default `row-label`: `'Field of View'`. Event: `change` → `{ value: number }`.

### `gc-deadzone-slider` — `DeadzoneSlider`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number (0..1) | `0.15` | stick deadzone fraction |

Event: `change` → `{ value: number }`.

### `gc-volume-slider` — `VolumeSlider`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number (0..1) | `0.8` | level |
| `muted` | boolean attr | absent | mute state, disables slider |

Default `row-label`: `'Volume'`. Events: `change` → `{ value: number }`, `toggle-mute` → `void`.

### `gc-mouse-sensitivity` — `MouseSensitivity`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number | `1` | main sensitivity |
| `ads` | number \| `null` | `null` | when set, renders ADS sensitivity row |

Default `row-label`: `'Mouse sensitivity'`. Event: `change` → `{ key: 'main' \| 'ads', value: number }`.

### `gc-toggle-row` — `ToggleRow`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `checked` | boolean attr | absent | toggle state |

Event: `change` → `{ value: boolean }`. Control: 44×22 switch with knob.

### `gc-fullscreen-toggle` / `gc-invert-axis-toggle` / `gc-vsync-toggle` — extend `ToggleRow`

Same API as `gc-toggle-row`. Default labels: `'Fullscreen'`, `'Invert Y axis'`, `'V-Sync'`.

### `gc-select-row` — `SelectRow`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | string | `''` | selected option value |
| `options` (prop only) | `SelectOption[] = { value, label }[]` | `[]` | populate via property |

Event: `change` → `{ value: string }`. Renders gilded native `<select>`.

### `gc-fps-cap-select` — `FPSCapSelect` (extends `SelectRow`)

Default `row-label`: `'FPS Cap'`. Default options: `30`, `60`, `120`, `144`, `240`, `Unlimited`.

### `gc-graphics-preset-picker` — `GraphicsPresetPicker`

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | string | `'medium'` | one of `low`, `medium`, `high`, `ultra` |

Default `row-label`: `'Quality preset'`. Event: `change` → `{ value: string }`. Control: button toggle group.

### `gc-reset-to-defaults` — `ResetToDefaults`

Default `row-label`: `'Reset to defaults'`. State: `idle` → button "Reset"; click switches to `confirming` ("Confirm reset" + Cancel). Event: `reset` → `void` on confirm.

**Use when (whole group):** building a settings screen; place each row inside `gc-panel[bordered]` to inherit divider lines.
**Skip when:** the row needs custom layout (drop down to raw markup composing `gc-metal-button` + `gc-toggle-row`).

---

## Character Management

### `gc-character-create` — `CharacterCreate`

Form-driven character builder: name input + mixed-type fields (text / select / number / range) + Confirm.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | string | `''` | character name; reflected to attr |
| `fields` (prop only) | `CharacterCreateField[] = { id, label, type?, options?, min?, max? }[]` | `[]` | populate via property |
| `values` (prop only) | `Record<string, string \| number>` | `{}` | initial field values |

Type: `CharacterCreateField` exported.
Slot: none (re-renders innerHTML).
Events: `name` → `{ value: string }` on name input, `change` → `{ id: string, value: string \| number }` on field change, `confirm` → `{ name: string, values: Record<string, string \| number> }` on Confirm.
Accessibility: host `role="form"`.

**Use when:** new-character flow with custom attribute / class / origin fields.
**Skip when:** prebuilt roster pick (use `gc-character-select`).

---

### `gc-character-select` — `CharacterSelect`

Roster grid (portrait + name + role tile) with side-detail panel. Click selects, dblclick confirms.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `selected-id` / `selectedId` | string | `''` | currently-selected character id |
| `characters` (prop only) | `CharacterEntry[] = { id, name, role?, locked?, portrait?, description?, stats? }[]` | `[]` | populate via property |

Type: `CharacterEntry` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{ id: string }` on click / Enter / Space, `confirm` → `{ id: string }` on dblclick.
Accessibility: host `role="listbox"`. Tiles have `role="option"`, `aria-selected`, `aria-disabled` when locked.

**Use when:** title-screen / lobby roster picker with locked + unlocked tiles.
**Skip when:** create-new flow (use `gc-character-create`), generic icon list (use `gc-list`).

---

### `gc-player-card` — `PlayerCard`

Friend / roster card: name + title + presence pip + rank/level row + stat grid + action buttons (Invite, Whisper, Block …).

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `player-name` / `playerName` | string | `''` | display caps player name |
| `card-title` / `cardTitle` | string | `''` | italic flavor line under name |
| `rank` | string | `''` | display caps rank label |
| `level` | number \| `null` | `null` | rendered as mono `Lv N` |
| `online-status` / `onlineStatus` | `PresenceStatus = 'online' \| 'away' \| 'busy' \| 'offline' \| 'in-game'` | `'offline'` | drives presence pip + label |
| `stats` (prop only) | `PlayerCardStat[] = { label, value }[]` | `[]` | 2-col stat grid |
| `actions` (prop only) | `PlayerCardAction[] = { id, label, danger? }[]` | `[]` | row of `gc-metal-button size="sm"` |

Type: `PresenceStatus`, `PlayerCardStat`, `PlayerCardAction` exported.
Slot: none (re-renders innerHTML).
Events: `action` → `{ id: string }` on action button click.

**Use when:** friend hover card, roster row detail, profile preview.
**Skip when:** in-game HUD player frame with HP/MP bars (use `gc-player-frame`).

---

### `gc-player-frame` — `PlayerFrame`

In-world / HUD player frame: portrait medallion + name/class header + HP bar with optional MP and stamina bars.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | string | `''` | display caps player name |
| `class-name` / `className` | string | `''` | small uppercase class label |
| `glyph` | string | `''` | initial / icon centered in portrait |
| `level` | number \| `null` | `null` | level badge on portrait |
| `hp` | number | `0` | current HP |
| `hp-max` / `hpMax` | number | `100` | max HP |
| `mp` | number | `0` | current MP |
| `mp-max` / `mpMax` | number | `100` | max MP |
| `stamina` | number | `0` | current stamina |
| `stamina-max` / `staminaMax` | number | `100` | max stamina |
| `show-mp` / `showMp` | boolean attr | absent | renders MP bar when set |
| `show-stamina` / `showStamina` | boolean attr | absent | renders stamina bar when set |

Slot: none (re-renders innerHTML; composes `gc-portrait`, `gc-health-bar`, `gc-mana-bar`, `gc-stamina-bar`).
Events: none.

**Use when:** party-member HUD frame, single-player resource frame top-left of screen.
**Skip when:** standalone health bar (use `gc-health-bar`), profile / friends-list card (use `gc-player-card`).

---

## Game Screens

### `gc-title-screen` — `TitleScreen`

Top-level title card: eyebrow + display title + diamond divider + italic subtitle. Sits inside an artboard backdrop.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `title-text` / `titleText` | string | `''` | rendered in `gc-title` at 44px |
| `subtitle` | string | `''` | italic body line under divider |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** game start title card before main menu, chapter splash.
**Skip when:** main-menu navigation (use `gc-main-menu`), full result/end screen (use `gc-result-screen`).

---

### `gc-loading-screen` — `LoadingScreen`

Loading card: eyebrow + title + label/percent row + progress bar (determinate or indeterminate) + cycling tip block.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `progress` | number (0..1) \| `null` | `null` | `null` → indeterminate animated bar |
| `label` | string | `''` | left side of label row |
| `eyebrow` | string | `'Loading'` | above title |
| `title-text` / `titleText` | string | `''` | display title |
| `tip-title` / `tipTitle` | string | `'Tip'` | eyebrow above tip body |
| `tip-interval` / `tipInterval` | number (ms) | `5000` | tip rotation interval |
| `tips` (prop only) | `string[]` | `[]` | rotated automatically when ≥ 2 entries |

Slot: none (re-renders innerHTML).
Events: none.
Accessibility: host `role="status"`, `aria-live="polite"`.

**Use when:** asset load splash, scene transition splash, matchmaking warmup.
**Skip when:** ring-only ability progress (use `gc-circular-progress`), scene-transition curtain (use `gc-transition-wipe`).

---

### `gc-pause-screen` — `PauseScreen`

Modal pause overlay (variant of pause-menu): eyebrow + title + diamond divider + items list (default `resume`/`restart`/`quit`). Esc + backdrop click emit `resume`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | boolean attr (reflected) | absent | drives visibility |
| `screen-title` / `screenTitle` | string | `'Paused'` | display title |
| `items` (prop only) | `PauseScreenItem[] = { id, label, disabled?, badge? }[]` | default resume/restart/quit | falsy/empty falls back to defaults |

Type: `PauseScreenItem` exported.
Slot: none (re-renders innerHTML).
Events: `resume` → `void`, `restart` → `void`, `quit` → `void` (auto-dispatched when an item with the matching id is activated; backdrop click and Esc emit `resume`). `select` → `{ id: string }` for any item activation.
Accessibility: `role="dialog"`, `aria-modal="true"`. Items have `role="menuitem"`.

**Use when:** in-game pause overlay where the three actions are intrinsic and consumers want named events.
**Skip when:** generic data-driven pause menu (use `gc-pause-menu`), main-menu navigation (use `gc-main-menu`).

---

### `gc-result-screen` — `ResultScreen`

Round-end summary: eyebrow + display title (color tinted) + subtitle + stat grid + reward chips + action button row.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `title-text` / `titleText` | string | `''` | screen title |
| `subtitle` | string | `''` | italic flavor line |
| `title-color` / `titleColor` | `ResultScreenTitleColor = 'gold' \| 'danger' \| 'parch'` | `'gold'` | drives title color/shadow |
| `stats` (prop only) | `ResultStat[] = { label, value }[]` | `[]` | 2-col grid |
| `rewards` (prop only) | `ResultReward[] = { label, glyph?, amount?, color? }[]` | `[]` | chip row under "Rewards" eyebrow |
| `actions` (prop only) | `ResultAction[] = { id, label, variant? }[]` | `[]` | row of `gc-metal-button` |

Types: `ResultScreenTitleColor`, `ResultStat`, `ResultReward`, `ResultAction` exported.
Slot: none (re-renders innerHTML).
Events: `action` → `{ id: string }` on action button click.

**Use when:** generic round-/match-end summary that may be either win or lose flavor.
**Skip when:** dedicated victory/defeat screens (use `gc-victory-screen` / `gc-game-over-screen`), career stats (use `gc-stats-screen`).

---

### `gc-game-over-screen` — `GameOverScreen` (extends `ResultScreen`)

Same API as `gc-result-screen` with defaults `titleText='Game Over'`, `titleColor='danger'`, eyebrow `Defeat`.

**Use when:** explicit defeat result screen.

### `gc-victory-screen` — `VictoryScreen` (extends `ResultScreen`)

Same API as `gc-result-screen` with defaults `titleText='Victory!'`, `titleColor='gold'`, eyebrow `Triumph`.

**Use when:** explicit victory result screen.

---

### `gc-stats-screen` — `StatsScreen`

Career statistics: header (eyebrow + title + diamond divider + summary) + grid of stat-section panels.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `screen-title` / `screenTitle` | string | `'Stats'` | display title |
| `summary` | string | `''` | italic body line under divider |
| `sections` (prop only) | `StatsSection[] = { title, stats: { label, value }[] }[]` | `[]` | stat group cards |

Types: `StatsSection`, `StatsScreenStat` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** career-summary / lifetime-stats screen.
**Skip when:** single round summary (use `gc-result-screen`), in-tooltip stat block (use plain mono spans).

---

### `gc-matchmaking-screen` — `MatchmakingScreen`

Matchmaking state machine: spinning ring + state-derived eyebrow + title + meta row (mode / region / elapsed / eta) + Accept/Cancel.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `state` | `MatchmakingScreenState = 'searching' \| 'connecting' \| 'found' \| 'failed' \| 'idle'` | `'idle'` | drives ring animation, action row, copy |
| `elapsed` | number (s) | `0` | shown only while searching/connecting |
| `estimated` | number (s) | `0` | optional ETA, shown only while searching/connecting |
| `region` | string | `''` | optional meta cell |
| `mode` | string | `''` | optional meta cell |
| `found-label` / `foundLabel` | string | `'Match Found'` | title shown when state is `found` |

Type: `MatchmakingScreenState` exported.
Slot: none (re-renders innerHTML).
Events: `accept` → `void` (Accept button, only shown in `found`), `cancel` → `void` (Cancel/Decline button while searching/connecting/found/failed).

**Use when:** matchmaking / queue screen with a clear state transition.
**Skip when:** simple progress card (use `gc-loading-screen`), invite toast (use `gc-invite-toast`).

---

## Input & Binding

### `gc-controls-rebind-list` — `ControlsRebindList`

List of action rows (action label + current key glyph + Rebind affordance). Pure list — does not capture keys itself; emits `rebind` so a host can drive a `gc-key-binder` modal.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `bindings` (prop only) | `ControlBinding[] = { id, action, key? }[]` | `[]` | populate via property |

Type: `ControlBinding` exported.
Slot: none (re-renders innerHTML).
Events: `rebind` → `{ id: string }` on row click / Enter / Space.
Accessibility: host `role="list"`. Rows are `role="listitem"`, `tabindex="0"`.

**Use when:** settings → controls screen — listing every action with its current bind. Compose inside a `gc-panel[bordered]` for divider lines.
**Skip when:** single inline rebind affordance (use `gc-key-binder`).

---

## Inventory & Items

### `gc-item-slot` — `ItemSlot`

Square framed item slot with rarity ring, hotkey badge, qty stack, equipped marker, cooldown overlay, locked overlay.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `item` (prop only) | `InventoryItem \| null` | `null` | drives glyph, rarity, qty, cooldown, equipped, locked |
| `selected` | boolean attr (reflected) | absent | adds gold outer ring + glow |
| `size` | number (px) | `56` | host width/height; glyph ≈ 0.42× |
| `hotkey` | string | `''` | top-left mono badge |

Type: `InventoryItem = { id, name?, icon?, rarity?, qty?, cooldown?, cooldownMax?, equipped?, locked? }` exported. Rarity values match `ItemRarity` from `gc-rarity-chip`.
Slot: none (re-renders innerHTML).
Events: `click` → `{ item: InventoryItem | null }` on click / Enter / Space (suppressed when locked).
Accessibility: `role="button"`, `tabindex="0"` (`-1` when locked), `aria-disabled` when locked, `:focus-visible` ring.

**Use when:** atomic inventory cell — base unit for `gc-hotbar`, `gc-inventory-grid`, `gc-equipment-doll`. Use directly only when standalone.
**Skip when:** non-item glyph badge (use `gc-icon-badge`), buff status pip (use `gc-buff-icon`), skill cell with cooldown ring (use `gc-skill-bar` cell — same look, different event semantics).

---

### `gc-item-tooltip` — `ItemTooltip`

Rarity-tinted gilded panel: header (type eyebrow + name + rarity chip) + stat rows + requirements + italic flavor.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `item` (prop only) | `TooltipItem \| null` | `null` | hides element when null (display:none) |

Type: `TooltipItem extends InventoryItem = { …, typeLabel?, flavor?, stats?, requirements? }` exported. `requirements[].met = false` → blood color, `met = true` → stamina color.
Slot: none (re-renders innerHTML).
Events: none.
Accessibility: `role="tooltip"`.

**Use when:** hover-card / detail panel for inventory or shop items. Tinted by item rarity.
**Skip when:** inline rarity tag only (use `gc-rarity-chip`), full equipment-vs-candidate compare (use `gc-item-compare`).

---

### `gc-item-compare` — `ItemCompare`

Two `gc-item-tooltip` columns (Equipped vs Candidate) plus a delta panel highlighting numeric stat differences.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `current` (prop only) | `TooltipItem \| null` | `null` | left column ("Equipped") |
| `candidate` (prop only) | `TooltipItem \| null` | `null` | right column ("Candidate"); when set with `current`, deltas render under candidate |

Slot: none (re-renders innerHTML; composes `gc-item-tooltip`).
Events: none.

**Use when:** shop / loot pickup hover that compares against currently equipped slot. Gives stat-by-stat ↑/↓ readout.
**Skip when:** single-item hover (use `gc-item-tooltip`).

---

### `gc-hotbar` — `Hotbar`

Inline strip of `gc-item-slot` cells with hotkey badges. Single-select via `selected-id`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `slots` (prop only) | `HotbarSlot[] = { item?, hotkey? }[]` | `[]` | populate via property |
| `slot-size` / `slotSize` | number (px) | `56` | per-cell size |
| `selected-id` / `selectedId` | string | `''` | id of the selected item; matches `slot.item.id` |

Type: `HotbarSlot` exported.
Slot: none (re-renders innerHTML; composes `gc-item-slot`).
Events: `select` → `{ item: InventoryItem | null, index: number }` on cell click.
Accessibility: host `role="toolbar"`.

**Use when:** action-game / RPG hotbar with persistent slots and number-key prompts.
**Skip when:** ability bar with cooldown rings + charges (use `gc-skill-bar`), full inventory grid (use `gc-inventory-grid`).

---

### `gc-inventory-grid` — `InventoryGrid`

Uniform grid of `gc-item-slot` cells. Single-select via `selected-id`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `items` (prop only) | `(InventoryItem \| null)[]` | `[]` | populate via property; null entries render as empty cells |
| `columns` | number | `6` | grid column count |
| `slot-size` / `slotSize` | number (px) | `56` | per-cell size |
| `selected-id` / `selectedId` | string | `''` | id of selected item |

Slot: none (re-renders innerHTML; composes `gc-item-slot`).
Events: `select` → `{ item: InventoryItem | null, index: number }` on cell click.
Accessibility: host `role="grid"`.

**Use when:** main inventory / chest / storage screen.
**Skip when:** action-bar / hotbar (use `gc-hotbar`), equipment paper-doll (use `gc-equipment-doll`).

---

### `gc-equipment-doll` — `EquipmentDoll`

Character paper-doll: percent-positioned `gc-item-slot` anchors over a silhouette glyph. Single-select via `selected-id`.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `slots` (prop only) | `EquipmentSlotConfig[] = { id, label?, item?, x, y }[]` | `[]` | `x` / `y` are 0..100 percent of host |
| `silhouette` | string | `''` (renders default ⚔) | center backdrop glyph |
| `width` | number (px) | `240` | host width |
| `height` | number (px) | `360` | host height |
| `slot-size` / `slotSize` | number (px) | `56` | per-anchor slot size |
| `selected-id` / `selectedId` | string | `''` | currently-selected slot id |

Type: `EquipmentSlotConfig` exported.
Slot: none (re-renders innerHTML; composes `gc-item-slot`).
Events: `select` → `{ id: string }` on slot click.

**Use when:** equipment / paper-doll character sheet. Slot positions are content-driven percentages.
**Skip when:** flat list (use `gc-list-row`), inventory grid (use `gc-inventory-grid`).

---

## Ability & Skills

### `gc-ability-card` — `AbilityCard`

Rarity-tinted card showing ability icon + name + description + cooldown/cost/range meta + keybind glyph.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `ability-name` / `abilityName` | string | `''` | display caps name, colored by rarity |
| `icon` | string | `''` | Unicode or `bi-*`; rendered inside `gc-icon-badge` size 48 |
| `description` | string | `''` | italic body line |
| `cooldown` | string | `''` | meta row when set (e.g. `'8s'`) |
| `cost` | string | `''` | meta row when set (e.g. `'40 MP'`) |
| `range` | string | `''` | meta row when set (e.g. `'32m'`, `'Melee'`) |
| `keybind` | string | `''` | rendered inside `gc-key` on the right of the header |
| `rarity` | `AbilityCardRarity = 'common' \| 'uncommon' \| 'rare' \| 'epic' \| 'legendary'` | `'common'` | drives name color + outer glow tint |

Type: `AbilityCardRarity` exported.
Slot: none (re-renders innerHTML; composes `gc-icon-badge`, `gc-eyebrow`, `gc-key`).
Events: none.

**Use when:** spellbook / talent picker / ability detail panel — static read-only card. Pairs with `gc-skill-bar` for hotkey selection.
**Skip when:** in-action skill cell (use `gc-skill-bar`), generic item tooltip (use `gc-item-tooltip`).

---

### `gc-skill-bar` — `SkillBar`

Action bar of skill cells: glyph + hotkey + charge count + cooldown conic-gradient. Single-activate via `activate` event.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `slots` (prop only) | `SkillSlot[] = { id, icon?, hotkey?, cooldown?, remaining?, charges?, disabled?, selected? }[]` | `[]` | populate via property |
| `slot-size` / `slotSize` | number (px) | `56` | per-cell size |
| `gap` | string (CSS length) | `'6px'` | spacing between cells |

Type: `SkillSlot` exported.
Slot: none (re-renders innerHTML).
Events: `activate` → `{ id: string }` on cell click / Enter / Space (suppressed when `disabled`).
Accessibility: host `role="toolbar"`. Each cell is `role="button"`, `tabindex="0"` (or `-1` when disabled), `aria-disabled` when disabled.

**Use when:** ability hotbar with cooldown ring + charges + selected highlight. Activation-style HUD bar.
**Skip when:** static ability detail card (use `gc-ability-card`), inventory hotbar with item icons + qty (use `gc-hotbar`).

---

## Map & Navigation

### `gc-compass-bar` — `CompassBar`

Horizontal heading strip with cardinal labels and FOV-culled markers.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `heading` | number (degrees) | `0` | current player heading |
| `fov` | number (degrees) | `90` | visible angular window |
| `markers` (prop) | `CompassMarker[]` | `[]` | `{id, heading, color?, label?, icon?}`; markers outside fov are culled |
| `width` | number (px) | `320` | track width |
| `height` | number (px) | `28` | track height |
| `show-cardinals` | boolean attr | absent | renders N/NE/E/SE/S/SW/W/NW labels at heading |

Type: `CompassMarker` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** FPS/3D HUD heading band — shows direction relative to player facing.
**Skip when:** want top-down compass dial (use `gc-compass-rose`).

---

### `gc-minimap` — `Minimap`

Square framed minimap projecting world coordinates onto a centred view with markers and optional rotation.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `world-x` / `worldX` | number | `0` | top-left world X of viewport |
| `world-y` / `worldY` | number | `0` | top-left world Y of viewport |
| `world-width` / `worldWidth` | number | `100` | viewport width in world units |
| `world-height` / `worldHeight` | number | `100` | viewport height in world units |
| `markers` (prop) | `MinimapMarker[]` | `[]` | `{id, x, y, color?, size?}`; out-of-viewport markers are culled |
| `background-image` / `backgroundImage` | string (URL) | `''` | background tile/map image |
| `size` | number (px) | `180` | square edge length |
| `rotation` | number (degrees) | `0` | rotates the surface; player glyph stays centred |

Type: `MinimapMarker` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** corner HUD minimap with markers.
**Skip when:** full-screen world map (build a custom screen).

---

### `gc-objective-marker` — `ObjectiveMarker`

Pulsing diamond marker with label and distance, anchored absolutely inside a positioned parent.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `x` | number (px) | absent | sets `left` on the host |
| `y` | number (px) | absent | sets `top` on the host |
| `label` | string | `''` | marker label |
| `distance` | number (m) | absent | rendered as `{n}m` or `{n.n}km` |
| `color` | string (CSS color) | gold | drives glyph color/glow |
| `size` | number (px) | `22` | glyph size |
| `pulse` | boolean attr | absent | reflected; toggles pulse animation |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** primary objective beacon over the world.
**Skip when:** secondary directional cue (use `gc-waypoint-marker`).

---

### `gc-waypoint-marker` — `WaypointMarker`

Static waypoint marker with custom icon, label, and distance readout.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `x` | number (px) | absent | sets `left` on the host |
| `y` | number (px) | absent | sets `top` on the host |
| `label` | string | `''` | marker label |
| `distance` | number (m) | absent | rendered as `{n}m` or `{n.n}km` |
| `color` | string (CSS color) | gold | drives glyph color/glow |
| `icon` | string (glyph) | `'✦'` | leading icon |
| `size` | number (px) | `18` | glyph size |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** secondary points of interest, non-pulsing.
**Skip when:** primary objective (use `gc-objective-marker`).

---

## Social & Communication

### `gc-chat-window` — `ChatWindow`

Multi-channel chat panel with tab strip, message log, and compose input.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `messages` (prop) | `ChatMessage[]` | `[]` | `{id, channel?, sender, body, color?, system?}`; system messages styled distinct |
| `channels` (prop) | `ChatChannel[]` | `[]` | `{id, label, color?}` |
| `active-channel` / `activeChannel` | string | `''` | selected tab id |
| `placeholder` | string | `'Say something...'` | compose input placeholder |
| `width` | number (px) | `360` | panel width |
| `height` | number (px) | `280` | panel height |

Types: `ChatMessage`, `ChatChannel` exported.
Slot: none (re-renders innerHTML).
Events: `send` → `{channel, text}` on Enter / send-button (clears input); `channel-change` → `{id}` on tab activation. Auto-scrolls log to bottom on update.

**Use when:** in-game chat with multiple channels.
**Skip when:** single-line dialogue (use `gc-dialogue-box`).

---

### `gc-friends-list` — `FriendsList`

Sortable friends roster with status pip, activity line, rank chip, and per-row invite/message actions.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `friends` (prop) | `Friend[]` | `[]` | `{id, name, status?, activity?, rank?}` |
| `list-title` / `listTitle` | string | `'Friends'` | header label |

Type: `Friend`, `FriendStatus` exported.
Slot: none (re-renders innerHTML).
Events: `invite` → `{id}` on invite click; `message` → `{id}` on message click. Auto-sorts by status (in-game > online > busy > away > offline), then name. Offline rows italicised and dimmed.

**Use when:** social menu friends panel.
**Skip when:** generic player roster (use `gc-list`).

---

### `gc-mute-list` — `MuteList`

List of muted players with reason, timestamp, and per-row unmute action.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `players` (prop) | `MutedPlayer[]` | `[]` | `{id, name, mutedAt?, reason?}`; renders empty state when zero |

Type: `MutedPlayer` exported.
Slot: none (re-renders innerHTML).
Events: `unmute` → `{id}` on unmute click.

**Use when:** social settings mute manager.
**Skip when:** also need ban/report flow (use `gc-report-player-dialog`).

---

### `gc-kill-feed` — `KillFeed`

Stack of recent kill notifications with optional headshot indicator.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `entries` (prop) | `KillFeedEntry[]` | `[]` | `{id, killerName, victimName, killerColor?, victimColor?, weapon?, headshot?}` |
| `max-visible` / `maxVisible` | number | `5` | shows the last N entries |

Type: `KillFeedEntry` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** PvP HUD kill log.
**Skip when:** general chat scroll (use `gc-chat-window`).

---

## Progression & Content

### `gc-level-header` — `LevelHeader`

Account/character level badge with title, XP bar, and next-unlock label.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `level` | number | `1` | shown inside medallion badge |
| `title` | string | `''` | name/title beside the badge |
| `xp` | number | `0` | current XP |
| `xp-max` / `xpMax` | number | `100` | XP needed for next level |
| `next-label` / `nextLabel` | string | `''` | optional next-unlock label |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** profile / stats screen header.
**Skip when:** generic XP bar only (use `gc-resource-bar-base`).

---

### `gc-level-select` — `LevelSelect`

World-map-style level picker with SVG-rendered nodes, edges, locked/completed states, and star ratings.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `nodes` (prop) | `LevelNode[]` | `[]` | `{id, x, y, label?, icon?, locked?, completed?, stars?, bestStars?}` |
| `edges` (prop) | `LevelEdge[]` | `[]` | `{from, to}` referencing node ids |
| `selected-id` / `selectedId` | string | `''` | currently focused node |
| `width` | number (px) | `600` | canvas width |
| `height` | number (px) | `360` | canvas height |

Types: `LevelNode`, `LevelEdge` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on click / Enter / Space; `confirm` → `{id}` on dblclick. Locked nodes ignore activation.
Accessibility: host `role="listbox"`. Each node `role="option"`, `aria-selected`, `aria-disabled` when locked.

**Use when:** stage / world map level picker.
**Skip when:** linear list of levels (use `gc-list`).

---

### `gc-skill-tree` — `SkillTree`

Talent tree with diamond-rotated nodes, unlock edges, ranks, and remaining-points readout.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `nodes` (prop) | `SkillNode[]` | `[]` | `{id, x, y, label?, icon?, locked?, unlocked?, rank?, maxRank?, description?}` |
| `edges` (prop) | `SkillTreeEdge[]` | `[]` | `{from, to}` |
| `selected-id` / `selectedId` | string | `''` | currently selected node |
| `points` | number \| null | absent | available skill points header chip |
| `width` | number (px) | `600` | canvas width |
| `height` | number (px) | `400` | canvas height |

Types: `SkillNode`, `SkillTreeEdge` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on click / Enter / Space; `unlock` → `{id}` on dblclick. Edges between two unlocked nodes render solid gold; otherwise dashed.
Accessibility: host `role="tree"`. Each node `role="treeitem"`.

**Use when:** RPG talent tree / passive grid.
**Skip when:** linear ability list (use `gc-skill-bar`).

---

### `gc-codex` — `Codex`

Bestiary/lore index with discovered/undiscovered entries, list, and detail pane.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `entries` (prop) | `CodexEntry[]` | `[]` | `{id, name, icon?, discovered?, description?, stats?}` |
| `selected-id` / `selectedId` | string | `''` | initially selected entry |

Type: `CodexEntry` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on row click / Enter / Space. Undiscovered rows show `???` and dimmed.

**Use when:** bestiary, lore archive, item collection.
**Skip when:** active quest log (use `gc-journal`).

---

### `gc-journal` — `Journal`

Quest journal with state-coloured rows (active/completed/failed/inactive), objectives checklist, and reward summary.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `entries` (prop) | `JournalEntry[]` | `[]` | `{id, title, description?, body?, objectives?, state?, rewards?}` |
| `selected-id` / `selectedId` | string | `''` | initially selected quest |

Types: `JournalEntry`, `JournalObjective`, `JournalReward` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on row click / Enter / Space.

**Use when:** in-game quest log with completed/failed states.
**Skip when:** HUD-side active tracker only (use `gc-quest-tracker`).

---

### `gc-quest-tracker` — `QuestTracker`

HUD-side compact tracker showing active quests and per-objective progress (with bar when target known).

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `quests` (prop) | `QuestEntry[]` | `[]` | `{id, name, objectives}`; objective `{id, label, progress?, target?, completed?, optional?}` |
| `tracker-title` / `trackerTitle` | string | `'Active Quests'` | header label |

Types: `QuestEntry`, `QuestObjective` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** HUD quest sidebar.
**Skip when:** full quest log with rewards (use `gc-journal`).

---

### `gc-achievement-list` — `AchievementList`

Achievement list with unlocked, in-progress (with bar), locked, and secret rows; optional point badge.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `achievements` (prop) | `Achievement[]` | `[]` | `{id, name, description?, icon?, unlocked?, progress?, target?, points?, secret?}` |

Type: `Achievement` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** achievements screen / trophy index.
**Skip when:** dynamic toast on unlock (build with `gc-invite-toast` shape).

---

### `gc-battle-pass` — `BattlePass`

Free/premium reward track with XP progress, season header, and per-tier claim cells.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `tiers` (prop) | `BattlePassTier[]` | `[]` | `{level, xpRequired, free?, premium?}`; reward `{label, icon?, claimed?}` |
| `current-level` / `currentLevel` | number | `1` | active tier; xp bar uses this tier's xpRequired |
| `current-xp` / `currentXp` | number | `0` | XP into the current tier |
| `season-name` / `seasonName` | string | `''` | header title |
| `season-end` / `seasonEnd` | string | `''` | rendered as `Ends {value}` |
| `has-premium` / `hasPremium` | boolean attr | absent | unlocks premium track cells |

Types: `BattlePassTier`, `BattlePassReward` exported.
Slot: none (re-renders innerHTML).
Events: `claim` → `{level, track}` on claimable cell click. Locked, claimed, gated cells are non-interactive.

**Use when:** seasonal battle/season pass UI.
**Skip when:** linear achievement list (use `gc-achievement-list`).

---

## Gameplay Panels

### `gc-crafting-panel` — `CraftingPanel`

Recipe list with selected detail showing inputs (insufficient highlighted) and craft button.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `recipes` (prop) | `CraftingRecipe[]` | `[]` | `{id, name, icon?, inputs, output}`; input `{item, qty, available?}`; output `{item, qty?}` |
| `selected-id` / `selectedId` | string | `''` | active recipe |
| `crafting` | boolean attr | absent | reflects in-progress; disables craft button + dims label |

Types: `CraftingRecipe`, `CraftingIngredient` exported. Reuses `InventoryItem` from `gc-item-slot`.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on row click / Enter / Space; `craft` → `{id}` on craft-button click. Craft button disabled when missing inputs or when `crafting` is set.

**Use when:** crafting workbench panel with input requirements.
**Skip when:** simple convert/deconstruct (build inline).

---

### `gc-shop-panel` — `ShopPanel`

Vendor panel with buy/sell mode, currency readout, discount chip, sold-out state, and per-row buy/sell action.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `items` (prop) | `ShopItem[]` | `[]` | `{item, price, discount?, soldOut?}`; discount as 0–1 fraction |
| `sell-mode` / `sellMode` | boolean attr | absent | flips header + emits `sell` instead of `buy` |
| `currency` | number \| null | absent | shown in header; rows go red when can't afford in buy mode |
| `currency-icon` / `currencyIcon` | string (glyph) | `'◆'` | currency glyph |

Type: `ShopItem` exported. Reuses `InventoryItem`.
Slot: none (re-renders innerHTML).
Events: `buy` → `{id}` (default mode) or `sell` → `{id}` (sell mode) on action-button click. Sold-out and unaffordable buttons disabled.

**Use when:** vendor / merchant interface.
**Skip when:** loot pickup list (use `gc-loot-list`).

---

### `gc-loot-list` — `LootList`

Drop list with rarity-coloured names, take-one, and take-all actions.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `items` (prop) | `LootEntry[]` | `[]` | `{item, qty?}`; rarity color from `item.rarity` |
| `list-title` / `listTitle` | string | `'Loot'` | header label |

Type: `LootEntry` exported. Reuses `InventoryItem`.
Slot: none (re-renders innerHTML).
Events: `take` → `{id}` on per-row take; `take-all` → `void` on take-all click. Take-all disabled when empty.

**Use when:** inline loot list inside an existing panel.
**Skip when:** modal popup framing required (use `gc-loot-popup`) or sortable inventory grid (use `gc-inventory-grid`).

---

### `gc-loot-popup` — `LootPopup`

Modal-framed wrapper around `gc-loot-list` with backdrop, Take-All / Discard buttons, Esc-to-close, and an optional auto-fade timer.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | boolean attr | absent | reflected; show/hide modal |
| `popup-title` / `popupTitle` | string | `'Loot'` | dialog title (display caps) |
| `eyebrow` | string | `'Acquired'` | small label above title; pass empty string to hide |
| `discard-label` / `discardLabel` | string | `'Discard'` | ghost button label |
| `auto-fade-ms` / `autoFadeMs` | number | `0` | when > 0 + `open`, emits `close` after that many ms; resets on `take` |
| `items` (prop) | `LootEntry[]` | `[]` | forwarded to inner `gc-loot-list` |

Slot: none (re-renders innerHTML).
Events: `take` → `{id}` (forwarded from inner list); `take-all` → `void`; `discard` → `void`; `close` → `void` (Esc key, backdrop click, or auto-fade expiry).

**Use when:** chest / corpse / kill loot pickup modal.
**Skip when:** loot list lives inside a larger always-on panel (use `gc-loot-list`).

---

## Social Panels

### `gc-guild-panel` — `GuildPanel`

Guild header with name, tag, motto, level, member cap, and online roster.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `guild-name` / `guildName` | string | `''` | guild display name |
| `tag` | string | `''` | rendered as `[TAG]` |
| `motto` | string | `''` | italic body text |
| `level` | number \| null | absent | header stat tile |
| `member-cap` / `memberCap` | number \| null | absent | rendered as `count/cap` |
| `members` (prop) | `GuildMember[]` | `[]` | `{id, name, rank?, online?, contribution?}`; offline rows dimmed |

Type: `GuildMember` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** guild/clan home page.
**Skip when:** matchmaking party (use `gc-party-panel`).

---

### `gc-party-panel` — `PartyPanel`

Compact party roster with ready state, host badge, role chip, and invite-into-empty-slot / leave actions.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `members` (prop) | `PartyMember[]` | `[]` | `{id, name, ready?, host?, role?}`; trimmed to `capacity` |
| `capacity` | number | `4` | total slot count; empty slots show invite affordance |

Type: `PartyMember` exported.
Slot: none (re-renders innerHTML).
Events: `leave` → `void` on leave-button click; `invite` → `void` on empty-slot click.

**Use when:** in-world party / co-op widget.
**Skip when:** lobby with mode/map and start button (use `gc-lobby`).

---

### `gc-lobby` — `Lobby`

Match lobby with mode/map meta, ready slots, host start button, and ready/leave actions.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `players` (prop) | `LobbyPlayer[]` | `[]` | `{id, name, ready?, host?, rank?}`; trimmed to `capacity` |
| `capacity` | number | `8` | total slots |
| `lobby-mode` / `lobbyMode` | string | `''` | mode meta tile + title fallback |
| `map-name` / `mapName` | string | `''` | map meta tile |
| `is-ready` / `isReady` | boolean attr | absent | reflects local-player ready toggle state |
| `can-start` / `canStart` | boolean attr | absent | enables host start button |

Type: `LobbyPlayer` exported.
Slot: none (re-renders innerHTML).
Events: `leave` → `void`; `ready` → `void`; `start` → `void` (host start).

**Use when:** pre-match player gather screen.
**Skip when:** post-queue matchmaking spinner (use `gc-matchmaking-screen`).

---

## UI Utilities & Specialized

### `gc-perk-picker` — `PerkPicker`

Grid of selectable perk cards with selected/locked states.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `perks` (prop) | `Perk[]` | `[]` | `{id, name, description?, icon?, selected?, locked?}` |
| `columns` | number | `3` | grid column count |

Type: `Perk` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on card click / Enter / Space (suppressed when locked).
Accessibility: host `role="listbox"`. Each card `role="option"`, `aria-selected`, `aria-disabled` when locked.

**Use when:** level-up perk choice / loadout perk grid.
**Skip when:** linear talent tree (use `gc-skill-tree`).

---

### `gc-radial-wheel` — `RadialWheel`

Modal radial menu with hover label, disabled options, Escape and backdrop close.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `options` (prop) | `RadialOption[]` | `[]` | `{id, icon?, label?, color?, disabled?}` |
| `open` | boolean attr | absent | reflected; toggles full-screen overlay |
| `radius` | number (px) | `120` | distance from center to option |
| `option-size` / `optionSize` | number (px) | `56` | per-option size |
| `center-label` / `centerLabel` | string | `''` | shown when no option is hovered |

Type: `RadialOption` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on enabled option click; `close` → `void` on Escape or backdrop click. Hovering an option swaps the center label to the option label.

**Use when:** in-game emote / weapon / ping wheel.
**Skip when:** static side menu (use `gc-main-menu`).

---

### `gc-save-slot-list` — `SaveSlotList`

Save/load slot list with autosave and empty states; mode flips between load and save buttons.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `slots` (prop) | `SaveSlot[]` | `[]` | `{id, name?, timestamp?, location?, level?, playtime?, empty?, autosave?}` |
| `selected-id` / `selectedId` | string | `''` | active slot |
| `mode` | `'load' \| 'save'` | `'load'` | drives action buttons (Load/Delete vs Save/Overwrite/Delete) |

Type: `SaveSlot`, `SaveSlotMode` exported.
Slot: none (re-renders innerHTML).
Events: `select` → `{id}` on row click / Enter / Space; `save` → `{id}` on save/overwrite button; `load` → `{id}` on load button; `delete` → `{id}` on delete button. Autosave rows can't be saved-into or deleted.
Accessibility: host `role="listbox"`. Each row `role="option"`.

**Use when:** save/load game screen.
**Skip when:** simple confirm dialog (use `gc-confirm-dialog`).

---

### `gc-controller-layout-preview` — `ControllerLayoutPreview`

Stylised controller silhouette with layout-specific face button glyphs and colors.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `layout` | `'xbox' \| 'playstation' \| 'nintendo' \| 'generic'` | `'generic'` | drives glyphs (X/Y/A/B vs ✕/◯/△/☐ vs Nintendo A/B/X/Y vs arrows) and colors |

Type: `ControllerLayout` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** controller layout previews in input/settings screens.
**Skip when:** single button glyph (use `gc-gamepad-button-prompt`).

---

### `gc-credits-list` — `CreditsList`

Static credits roster with role headings and names.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `sections` (prop) | `CreditsSection[]` | `[]` | `{role, names[]}` |

Type: `CreditsSection` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** static credits page.
**Skip when:** auto-scrolling end-credits (use `gc-credits-scroll`).

---

### `gc-credits-scroll` — `CreditsScroll`

Auto-scrolling end-credits with click-to-pause; emits complete when track passes the viewport.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `sections` (prop) | `CreditsSection[]` | `[]` | reuses `CreditsSection` from `gc-credits-list` |
| `speed` | number (px/sec) | `30` | scroll speed |
| `scroll-title` / `scrollTitle` | string | `''` | optional title shown above sections |

Slot: none (re-renders innerHTML).
Events: `complete` → `void` once at end of track. Click anywhere on the host toggles play/pause.

**Use when:** end-of-game credits roll.
**Skip when:** static credits page (use `gc-credits-list`).

---

### `gc-press-any-key` — `PressAnyKey`

Pulsing prompt that emits `continue` on any keydown or mousedown.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | string | `'Press Any Key'` | label text |

Slot: none (re-renders innerHTML).
Events: `continue` → `void` on document keydown (modifier keys ignored) or host mousedown.
Accessibility: host `role="button"`, `tabindex="0"`.

**Use when:** title-screen / cinematic continue prompt.
**Skip when:** explicit menu choice (use `gc-main-menu` or `gc-metal-button`).

---

### `gc-stat-row` — `StatRow`

Single label/value row with optional accent color and trend (up/down) glyph + delta.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | `''` | label text |
| `value` | string \| number | `''` | numeric values are localised |
| `accent` | string (CSS color) | gold | drives value color |
| `trend` | number \| null | absent | non-zero renders ▲ (up, stamina-bright) or ▼ (down, blood-bright) with abs delta |

Slot: none (re-renders innerHTML).
Events: none.

**Use when:** stats panels, item compare lines, ledger rows.
**Skip when:** full settings list row (use `gc-toggle-row`/`gc-select-row`/etc.).

---

### `gc-panel-header` — `PanelHeader`

Canonical eyebrow + title + diamond divider header for any framed panel or screen.

| Attribute / Prop | Type | Default | Notes |
|---|---|---|---|
| `eyebrow` | string | `''` | shown above title (display caps + wide tracking) |
| `header-title` / `headerTitle` | string | `''` | main heading |
| `title-size` / `titleSize` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | font-size scale: 14 / 18 / 26 / 36 px |

Type: `PanelHeaderTitleSize` exported.
Slot: none (re-renders innerHTML).
Events: none.

**Use when:** standard panel / dialog / screen header (replaces ad-hoc eyebrow + title + divider trios).
**Skip when:** plain heading without divider (use `gc-title` directly).

---

## Decision quick map

| Need | Use |
|---|---|
| stack children with gap | `gc-stack` |
| 2D uniform grid | `gc-grid` |
| pin to corner / edge | `gc-anchor` |
| safe-area inset wrapper | `gc-safe-area` |
| fixed aspect ratio container | `gc-aspect-ratio-box` |
| framed content block | `gc-panel` |
| heavy gilded frame | `gc-gilded-frame` |
| full-canvas backdrop | `gc-artboard-backdrop` |
| primary heading | `gc-title` |
| dynamic subtitle / dialogue line | `gc-subtitle` |
| section eyebrow tag | `gc-eyebrow` |
| inline key glyph | `gc-key` |
| prose / lore body | `gc-lore-text` |
| parchment scroll passage | `gc-scroll-text` |
| version/build label | `gc-version-label` |
| small framed glyph badge | `gc-icon-badge` |
| item rarity tag | `gc-rarity-chip` |
| inline currency value | `gc-currency-chip` |
| HUD currency readout | `gc-currency-display` |
| character medallion | `gc-portrait` |
| platform marker | `gc-platform-icon` |
| gamepad button prompt | `gc-gamepad-button-prompt` |
| heading compass | `gc-compass-rose` |
| custom-frame rune corner | `gc-rune-corner` |
| network latency readout | `gc-ping-display` |
| carousel page dots | `gc-page-indicator` |
| standalone gold rule + diamond divider | `gc-divider` |
| labeled fantasy CTA button | `gc-metal-button` |
| square back / close icon button | `gc-nav-button` |
| menu list entry (label + hotkey + icon) | `gc-menu-item` |
| generic selectable data row | `gc-list-row` |
| horizontal sub-tab strip | `gc-tab-bar` |
| modal pause overlay | `gc-pause-menu` |
| title-screen menu list | `gc-main-menu` |
| generic icon + label + meta list | `gc-list` |
| settings sidebar with content area | `gc-settings-category-list` |
| searchable single-select dropdown | `gc-combo-box` |
| typed dialogue with choices | `gc-dialogue-box` |
| player report submission modal | `gc-report-player-dialog` |
| timed party invite toast | `gc-invite-toast` |
| multi-section legal viewer | `gc-legal-screen` |
| ring progress / cooldown ring | `gc-circular-progress` |
| 32–64px slot-styled cooldown badge | `gc-cooldown-badge` |
| FPS hit confirmation marker | `gc-hit-marker` |
| floating damage / heal / miss text | `gc-damage-number` |
| 4-bar net quality icon | `gc-network-status-icon` |
| combo readout with timer drain | `gc-combo-counter` |
| score readout with multiplier | `gc-score-display` |
| full-viewport hit/cinematic flash | `gc-screen-flash` |
| rAF camera-shake wrapper | `gc-shake-container` |
| scene transition wipe | `gc-transition-wipe` |
| in-world interact prompt | `gc-interact-prompt` |
| HP / MP / stamina bar | `gc-health-bar` / `gc-mana-bar` / `gc-stamina-bar` |
| weapon ammo block | `gc-ammo-counter` |
| boss HP with phase ticks | `gc-boss-bar` |
| settings list row (FOV / volume / toggle / select / preset / reset) | `gc-fov-slider` / `gc-deadzone-slider` / `gc-volume-slider` / `gc-mouse-sensitivity` / `gc-toggle-row` / `gc-fullscreen-toggle` / `gc-invert-axis-toggle` / `gc-vsync-toggle` / `gc-select-row` / `gc-fps-cap-select` / `gc-graphics-preset-picker` / `gc-reset-to-defaults` |
| single buff/debuff icon | `gc-buff-icon` |
| active buffs HUD strip | `gc-buff-bar` |
| character builder form | `gc-character-create` |
| roster / character pick grid | `gc-character-select` |
| friend / profile preview card | `gc-player-card` |
| HUD player frame with HP/MP/stamina | `gc-player-frame` |
| start-of-game title splash | `gc-title-screen` |
| asset / scene loading splash | `gc-loading-screen` |
| modal pause overlay (intrinsic actions) | `gc-pause-screen` |
| round / match end summary | `gc-result-screen` |
| explicit defeat screen | `gc-game-over-screen` |
| explicit victory screen | `gc-victory-screen` |
| career / lifetime stats | `gc-stats-screen` |
| matchmaking / queue state screen | `gc-matchmaking-screen` |
| controls rebind list (action + key) | `gc-controls-rebind-list` |
| atomic inventory cell | `gc-item-slot` |
| item hover detail panel | `gc-item-tooltip` |
| equipped vs candidate compare | `gc-item-compare` |
| inline action-bar with item icons | `gc-hotbar` |
| inventory storage grid | `gc-inventory-grid` |
| character paper-doll | `gc-equipment-doll` |
| ability detail / talent card | `gc-ability-card` |
| ability hotbar with cooldowns | `gc-skill-bar` |
| FPS heading band with FOV-culled markers | `gc-compass-bar` |
| corner HUD minimap | `gc-minimap` |
| pulsing world objective beacon | `gc-objective-marker` |
| static world waypoint marker | `gc-waypoint-marker` |
| multi-channel chat panel | `gc-chat-window` |
| friends roster with status | `gc-friends-list` |
| muted players manager | `gc-mute-list` |
| PvP kill notification log | `gc-kill-feed` |
| profile / stats level header | `gc-level-header` |
| stage / world level picker | `gc-level-select` |
| RPG talent / skill tree | `gc-skill-tree` |
| bestiary / lore index | `gc-codex` |
| quest journal with rewards | `gc-journal` |
| HUD active-quest tracker | `gc-quest-tracker` |
| achievements screen | `gc-achievement-list` |
| seasonal battle pass track | `gc-battle-pass` |
| crafting workbench panel | `gc-crafting-panel` |
| vendor / shop panel | `gc-shop-panel` |
| loot pickup list (inline) | `gc-loot-list` |
| loot pickup modal with Take-All / Discard / auto-fade | `gc-loot-popup` |
| guild / clan home panel | `gc-guild-panel` |
| in-world party widget | `gc-party-panel` |
| pre-match lobby with start | `gc-lobby` |
| level-up perk grid | `gc-perk-picker` |
| in-world radial / quick wheel | `gc-radial-wheel` |
| save / load slot list | `gc-save-slot-list` |
| controller layout preview | `gc-controller-layout-preview` |
| static credits page | `gc-credits-list` |
| auto-scrolling end credits | `gc-credits-scroll` |
| title-screen continue prompt | `gc-press-any-key` |
| label/value/trend stat row | `gc-stat-row` |
| canonical panel header (eyebrow + title + diamond) | `gc-panel-header` |

## Composition notes

- `gc-anchor` requires a positioned ancestor (`gc-panel`/`gc-artboard-backdrop`/any `position: relative` host).
- `gc-subtitle` and `gc-version-label` overwrite their light-DOM `innerHTML` on every render — do not place children inside them, drive them via attributes.
- `gc-scroll-text` mutates light DOM (inserts a title node); avoid pre-populating a child with `data-gc-scroll-title` unless you want it managed.
- Slot-only components (`gc-eyebrow`, `gc-key`, `gc-lore-text`, `gc-panel`, `gc-gilded-frame`, `gc-artboard-backdrop`, `gc-stack`, `gc-grid`, `gc-anchor`, `gc-title`, `gc-rune-corner`, `gc-safe-area`, `gc-aspect-ratio-box`) accept any children including other `gc-*` elements.
- Indicator/badge components (`gc-icon-badge`, `gc-rarity-chip`, `gc-currency-chip`, `gc-currency-display`, `gc-portrait`, `gc-platform-icon`, `gc-gamepad-button-prompt`, `gc-compass-rose`, `gc-ping-display`, `gc-page-indicator`, `gc-divider`) overwrite their light-DOM `innerHTML` on every render — drive them via attributes, do not place children inside them.
- `gc-rune-corner` requires a `position: relative` parent (same as `gc-anchor`).
- All visual styling lives in `game-components/style/components/_<kebab>.scss`. The `.ts` files only set inline layout style on `gc-stack`, `gc-grid`, `gc-anchor`, plus CSS custom properties for size knobs (`--gc-title-size`, `--gc-subtitle-font-size`, `--gc-subtitle-max-width`).

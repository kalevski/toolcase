---
name: game-components
description: Use when building game UI with @toolcase/game-components — framework-free HTML5 Web Components (`gc-*` custom elements, no runtime libs). Covers 137 registered tags across layout, HUDs, menus, inventories, dialogs, settings, overlays, social/lobby, screens, and minimap/markers; consumable from React/Vue/Svelte/vanilla.
---

# game-components — API Reference

Vanilla Web Components for game UIs. No framework, no runtime deps beyond `@toolcase/base`. Every component registers under a `gc-*` tag and is consumable from React, Vue, Svelte, or plain HTML.

```ts
import { register } from '@toolcase/game-components'
import '@toolcase/game-components/style.css'

register() // registers all 137 custom elements via customElements.define
```

After `register()` you can author markup directly:

```html
<gc-stack direction="vertical" gap="12px">
    <gc-title>New Game</gc-title>
    <gc-health-bar value="68" max="100" show-text label="HP"></gc-health-bar>
    <gc-hotbar id="bar"></gc-hotbar>
</gc-stack>
<script>
    document.getElementById('bar').slots = [
        { item: { id: 'sword', name: 'Sword', icon: '⚔️' }, hotkey: '1' },
        { item: null, hotkey: '2' }
    ]
</script>
```

You can also import individual classes:

```ts
import { HealthBar, Hotbar, ItemSlot, type InventoryItem } from '@toolcase/game-components'
```

---

## Conventions

- **Tag names**: kebab-case prefix `gc-*`. Class names are PascalCase (e.g. `<gc-health-bar>` ↔ `HealthBar`).
- **Attributes ↔ properties**: most components mirror string/number/boolean attrs as JS properties (boolean = presence). Set primitive props via attributes; set complex data (arrays, objects) via JS properties (`el.slots = [...]`, `el.item = {...}`).
- **Events**: `CustomEvent` with `bubbles: true, composed: true`. Detail payloads typed via `*EventMap` interfaces (e.g. `MenuItemEventMap`, `ItemSlotEventMap`, `HotbarEventMap`).
- **Styling**: bundled CSS at `@toolcase/game-components/style.css`. Components read CSS variables (e.g. `--gc-title-size`, `--gc-bar-base`, `--fg-blood`) — override in your stylesheet for theming.
- **Rendering**: a few components (`MenuItem`, `Anchor`, `CooldownBadge`, …) use Shadow DOM with a single `<slot>`; most render to light DOM via `innerHTML`. Either way, safe to nest and reparent like any HTMLElement.

---

## Table of Contents

- [Layout](#layout)
- [Surfaces & Containers](#surfaces--containers)
- [Typography](#typography)
- [Badges, Chips, Icons](#badges-chips-icons)
- [Buttons & Menus](#buttons--menus)
- [Lists & Rows](#lists--rows)
- [Resource Bars](#resource-bars)
- [Settings Rows](#settings-rows)
- [Inventory & Items](#inventory--items)
- [HUD & Combat](#hud--combat)
- [Map & Markers](#map--markers)
- [Compass, Nav, Indicators](#compass-nav-indicators)
- [Effects & Overlays](#effects--overlays)
- [Dialogs & Inputs](#dialogs--inputs)
- [Social & Multiplayer](#social--multiplayer)
- [Screens](#screens)
- [Character & Player](#character--player)
- [Progression & Economy](#progression--economy)

---

## Layout

Flex / grid primitives.

| Tag | Class | Attributes | Notes |
|-----|-------|------------|-------|
| `gc-stack` | `Stack` | `direction='vertical'\|'horizontal'`, `gap`, `align`, `justify`, `wrap`, `inline` | Flexbox row/column. `gap` is any CSS length. |
| `gc-grid` | `Grid` | `columns`, `rows`, `gap`, `cell-size` | CSS grid with `repeat(columns, cell-size \|\| 1fr)`. |
| `gc-anchor` | `Anchor` | `position` (`top-left`\|`top`\|`top-right`\|`left`\|`center`\|`right`\|`bottom-left`\|`bottom`\|`bottom-right`), `inset` (CSS length, default `0px`) | Absolutely positions its slotted content at one corner/edge of the nearest positioned ancestor. Use one `<gc-anchor>` per position. |
| `gc-aspect-ratio-box` | `AspectRatioBox` | `ratio` (e.g. `'16:9'`) | Maintains intrinsic aspect ratio. |
| `gc-safe-area` | `SafeArea` | — | Honors `env(safe-area-inset-*)` (mobile/console UI). |
| `gc-divider` | `Divider` | `orientation` | Visual separator. |
| `gc-letterbox-bars` | `LetterboxBars` | `size` | Cinematic bars (cutscenes). |

```html
<gc-stack direction="horizontal" gap="8px" align="center" justify="space-between">
    <gc-title>HP</gc-title>
    <gc-health-bar value="50" max="100"></gc-health-bar>
</gc-stack>
```

---

## Surfaces & Containers

| Tag | Class | Purpose |
|-----|-------|---------|
| `gc-panel` | `Panel` | Themed surface w/ optional header. |
| `gc-panel-header` | `PanelHeader` | Title bar for `Panel`. |
| `gc-gilded-frame` | `GildedFrame` | Ornate frame for fantasy UI. |
| `gc-artboard-backdrop` | `ArtboardBackdrop` | Decorative backdrop (paper / parchment). |
| `gc-rune-corner` | `RuneCorner` | Corner glyph decoration. |

---

## Typography

| Tag | Class | Attributes |
|-----|-------|------------|
| `gc-title` | `Title` | `size` (number → sets `--gc-title-size` in `px`) |
| `gc-subtitle` | `Subtitle` | `size` |
| `gc-eyebrow` | `Eyebrow` | small uppercase label above heading |
| `gc-lore-text` | `LoreText` | flavor body copy |
| `gc-scroll-text` | `ScrollText` | scrolling marquee / credits-style text |
| `gc-version-label` | `VersionLabel` | corner build/version stamp |

All accept default slotted children as text content.

```html
<gc-eyebrow>CHAPTER 1</gc-eyebrow>
<gc-title size="48">Awakening</gc-title>
<gc-lore-text>The wind carries old names…</gc-lore-text>
```

---

## Badges, Chips, Icons

| Tag | Class | Notes |
|-----|-------|-------|
| `gc-icon-badge` | `IconBadge` | icon + numeric badge |
| `gc-rarity-chip` | `RarityChip` | exports `ItemRarity` type (`common`, `uncommon`, `rare`, …) |
| `gc-currency-chip` | `CurrencyChip` | small currency pill |
| `gc-currency-display` | `CurrencyDisplay` | larger amount + label |
| `gc-portrait` | `Portrait` | character portrait frame |
| `gc-platform-icon` | `PlatformIcon` | playstation/xbox/steam/etc |
| `gc-gamepad-button-prompt` | `GamepadButtonPrompt` | A/B/X/Y or generic prompt |
| `gc-key` | `Key` | keyboard key glyph |
| `gc-network-status-icon` | `NetworkStatusIcon` | connectivity indicator |
| `gc-ping-display` | `PingDisplay` | ms latency |

---

## Buttons & Menus

| Tag | Class | Notes |
|-----|-------|-------|
| `gc-metal-button` | `MetalButton` | primary CTA |
| `gc-nav-button` | `NavButton` | back / forward navigation |
| `gc-menu-item` | `MenuItem` | attrs: `label`, `hotkey`, `icon`, `selected`, `disabled`. Emits `select` (`{ label }`). Wraps as `role="menuitem"`. Click + Enter/Space activate. |
| `gc-main-menu` | `MainMenu` | full main-menu container |
| `gc-pause-menu` | `PauseMenu` | in-game pause overlay |
| `gc-tab-bar` | `TabBar` | tabbed switcher |
| `gc-press-any-key` | `PressAnyKey` | "press any key to continue" prompt |

```html
<gc-menu-item label="Continue" hotkey="C" selected></gc-menu-item>
<script>
    document.querySelector('gc-menu-item').addEventListener('select', e => start(e.detail.label))
</script>
```

---

## Lists & Rows

| Tag | Class |
|-----|-------|
| `gc-list-row` | `ListRow` |
| `gc-list` (`gc-list`) | `GcList` |
| `gc-stat-row` | `StatRow` |
| `gc-settings-category-list` | `SettingsCategoryList` |
| `gc-controls-rebind-list` | `ControlsRebindList` |
| `gc-controller-layout-preview` | `ControllerLayoutPreview` |
| `gc-save-slot-list` | `SaveSlotList` |
| `gc-friends-list` | `FriendsList` |
| `gc-mute-list` | `MuteList` |
| `gc-achievement-list` | `AchievementList` |
| `gc-credits-list` | `CreditsList` |
| `gc-credits-scroll` | `CreditsScroll` |
| `gc-loot-list` | `LootList` |

Set list data through a JS property (typically `items` / `slots`) — read each component's `*EventMap` for selection events.

---

## Resource Bars

All extend `ResourceBarBase` (abstract; not registered as a tag — extend it for custom bars).

```ts
abstract class ResourceBarBase extends HTMLElement {
    value: number          // attr 'value', default 0 (clamped 0..max)
    max: number            // attr 'max', default 100
    ghost: number | null   // attr 'ghost', preview overlay (e.g. predicted dmg)
    segments: number       // attr 'segments', dividers
    showText: boolean      // attr 'show-text'
    label: string          // attr 'label'
}
```

| Tag | Class | Notes |
|-----|-------|-------|
| `gc-health-bar`   | `HealthBar`   | red fill |
| `gc-mana-bar`     | `ManaBar`     | blue fill |
| `gc-stamina-bar`  | `StaminaBar`  | green/yellow fill |
| `gc-ammo-counter` | `AmmoCounter` | ammo/clip variant |
| `gc-boss-bar`     | `BossBar`     | wide top-of-screen boss bar |
| `gc-buff-bar`     | `BuffBar`     | row of buff icons (uses `BuffIcon`) |

```html
<gc-health-bar value="62" max="100" ghost="80" segments="4" show-text label="HP"></gc-health-bar>
```

---

## Settings Rows

Reusable settings row patterns. Most extend `SettingRowBase`.

| Tag | Class | Variant |
|-----|-------|---------|
| `gc-toggle-row` | `ToggleRow` | bool toggle row |
| `gc-fullscreen-toggle` | `FullscreenToggle` | toggle row preset |
| `gc-invert-axis-toggle` | `InvertAxisToggle` | toggle row preset |
| `gc-vsync-toggle` | `VSyncToggle` | toggle row preset |
| `gc-select-row` | `SelectRow` | dropdown row |
| `gc-fps-cap-select` | `FPSCapSelect` | preset FPS picker |
| `gc-graphics-preset-picker` | `GraphicsPresetPicker` | low/med/high/ultra |
| `gc-fov-slider` | `FOVSlider` | range slider preset |
| `gc-deadzone-slider` | `DeadzoneSlider` | range slider preset |
| `gc-volume-slider` | `VolumeSlider` | range slider preset |
| `gc-mouse-sensitivity` | `MouseSensitivity` | range slider preset |
| `gc-brightness-calibration` | `BrightnessCalibration` | calibration view |
| `gc-reset-to-defaults` | `ResetToDefaults` | reset action button |

---

## Inventory & Items

```ts
interface InventoryItem {
    id: string
    name?: string
    icon?: string
    rarity?: ItemRarity     // from RarityChip
    qty?: number
    cooldown?: number
    cooldownMax?: number
    equipped?: boolean
    locked?: boolean
}
```

| Tag | Class | Key shape |
|-----|-------|-----------|
| `gc-item-slot` | `ItemSlot` | prop `item: InventoryItem \| null`; attrs `selected`, `size` (px, default 56), `hotkey`. Event `click` (`{ item }`). |
| `gc-item-tooltip` | `ItemTooltip` | hover card for items |
| `gc-item-compare` | `ItemCompare` | side-by-side stat compare |
| `gc-hotbar` | `Hotbar` | prop `slots: HotbarSlot[]` (`{ item?, hotkey? }`); attrs `slot-size` (default 56), `selected-id`. Event `select` (`{ item, index }`). |
| `gc-inventory-grid` | `InventoryGrid` | grid of `ItemSlot`s |
| `gc-equipment-doll` | `EquipmentDoll` | paper-doll equip slots |
| `gc-ability-card` | `AbilityCard` | ability portrait + cooldown |
| `gc-skill-bar` | `SkillBar` | row of ability cards |
| `gc-skill-tree` | `SkillTree` | node graph of skills |
| `gc-radial-wheel` | `RadialWheel` | radial item selector |
| `gc-perk-picker` | `PerkPicker` | perk selection screen |

```ts
const hotbar = document.querySelector<Hotbar>('gc-hotbar')!
hotbar.slots = [
    { item: { id: 'potion', name: 'Healing Potion', icon: '🧪', qty: 3 }, hotkey: '1' },
    { item: null, hotkey: '2' }
]
hotbar.addEventListener('select', e => use(e.detail.item))
```

---

## HUD & Combat

| Tag | Class |
|-----|-------|
| `gc-crosshair` | `Crosshair` |
| `gc-hit-marker` | `HitMarker` |
| `gc-damage-number` | `DamageNumber` |
| `gc-combo-counter` | `ComboCounter` |
| `gc-score-display` | `ScoreDisplay` |
| `gc-interact-prompt` | `InteractPrompt` |
| `gc-speedometer` | `Speedometer` |
| `gc-buff-icon` | `BuffIcon` |
| `gc-circular-progress` | `CircularProgress` |
| `gc-cooldown-badge` | `CooldownBadge` (32–64px ring + countdown label) |
| `gc-particle-emitter` | `ParticleEmitter` |
| `gc-shake-container` | `ShakeContainer` (camera-shake wrapper) |
| `gc-screen-flash` | `ScreenFlash` |
| `gc-transition-wipe` | `TransitionWipe` |

```html
<gc-cooldown-badge size="48" value="2.4" max="6"></gc-cooldown-badge>
<gc-cooldown-badge size="40" value="0" max="8" label="READY"></gc-cooldown-badge>
```

`size` clamps to 32–64. `value` is time remaining (or any unit) and `max` is the total. The conic-gradient ring fills the remaining proportion; when `value <= 0` the ring drops in favour of a gold ready-glow. Pass `label` for a static center text or `show-label` to auto-format the remaining seconds (mm:ss above 60s, integer above 10s, one decimal otherwise).

---

## Map & Markers

| Tag | Class |
|-----|-------|
| `gc-minimap` | `Minimap` |
| `gc-objective-marker` | `ObjectiveMarker` |
| `gc-waypoint-marker` | `WaypointMarker` |

---

## Compass, Nav, Indicators

| Tag | Class |
|-----|-------|
| `gc-compass-rose` | `CompassRose` |
| `gc-compass-bar` | `CompassBar` |
| `gc-page-indicator` | `PageIndicator` |

---

## Effects & Overlays

| Tag | Class | Use |
|-----|-------|-----|
| `gc-vignette-overlay` | `VignetteOverlay` | low-health / damage vignette |
| `gc-blur-overlay` | `BlurOverlay` | background blur (pause / dialog backdrop) |
| `gc-loading-overlay` | `LoadingOverlay` | inline loading spinner overlay |
| `gc-debug-overlay` | `DebugOverlay` | dev/perf overlay |

---

## Dialogs & Inputs

| Tag | Class | Notes |
|-----|-------|-------|
| `gc-confirm-dialog` | `ConfirmDialog` | yes/no modal |
| `gc-loot-popup` | `LootPopup` | modal-framed loot list with Take-All / Discard + optional auto-fade |
| `gc-dialogue-box` | `DialogueBox` | NPC dialogue / typewriter text |
| `gc-combo-box` | `ComboBox` | dropdown input |
| `gc-toggle` | `Toggle` | bool switch (atomic) |
| `gc-check` | `Check` | checkbox |
| `gc-key-binder` | `KeyBinder` | capture next key/button press |
| `gc-report-player-dialog` | `ReportPlayerDialog` | moderation modal |
| `gc-invite-toast` | `InviteToast` | transient invite popup |

```ts
const popup = document.querySelector<LootPopup>('gc-loot-popup')!
popup.items = [
    { item: { id: 'gold', name: 'Gold', icon: '◆' }, qty: 320 },
    { item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'uncommon' } }
]
popup.popupTitle = 'Treasure Found'
popup.autoFadeMs = 4000
popup.open = true
popup.addEventListener('take', (e) => console.log('took', e.detail.id))
popup.addEventListener('take-all', () => popup.open = false)
popup.addEventListener('discard', () => popup.open = false)
popup.addEventListener('close', () => popup.open = false)
```

---

## Social & Multiplayer

| Tag | Class |
|-----|-------|
| `gc-chat-window` | `ChatWindow` |
| `gc-kill-feed` | `KillFeed` |
| `gc-lobby` | `Lobby` |
| `gc-party-panel` | `PartyPanel` |
| `gc-guild-panel` | `GuildPanel` |
| `gc-matchmaking-screen` | `MatchmakingScreen` |

---

## Screens

Full-viewport screen compositions.

| Tag | Class |
|-----|-------|
| `gc-title-screen` | `TitleScreen` |
| `gc-loading-screen` | `LoadingScreen` |
| `gc-pause-screen` | `PauseScreen` |
| `gc-result-screen` | `ResultScreen` |
| `gc-game-over-screen` | `GameOverScreen` |
| `gc-victory-screen` | `VictoryScreen` |
| `gc-stats-screen` | `StatsScreen` |
| `gc-legal-screen` | `LegalScreen` |

---

## Character & Player

| Tag | Class |
|-----|-------|
| `gc-character-create` | `CharacterCreate` |
| `gc-character-select` | `CharacterSelect` |
| `gc-player-card` | `PlayerCard` |
| `gc-player-frame` | `PlayerFrame` |
| `gc-level-header` | `LevelHeader` |
| `gc-level-select` | `LevelSelect` |

---

## Progression & Economy

| Tag | Class |
|-----|-------|
| `gc-codex` | `Codex` |
| `gc-journal` | `Journal` |
| `gc-quest-tracker` | `QuestTracker` |
| `gc-battle-pass` | `BattlePass` |
| `gc-crafting-panel` | `CraftingPanel` |
| `gc-shop-panel` | `ShopPanel` |

---

## Patterns

### Selective registration

`register()` registers all 137. To register one, import the class and call `customElements.define` directly:

```ts
import { HealthBar } from '@toolcase/game-components'
customElements.define('gc-health-bar', HealthBar)
```

### TypeScript tag map

Each module augments `HTMLElementTagNameMap`, so `document.querySelector('gc-hotbar')` is typed as `Hotbar`. Useful with `.slots = ...` / `.item = ...` setters.

### Theming

Override CSS custom properties on a wrapper:

```css
.theme-grim {
    --fg-blood: #6f1d1b;          /* HP bar base via cascading fallback */
    --gc-bar-base: #6f1d1b;       /* per-bar override */
    --gc-title-size: 32px;
}
```

```html
<div class="theme-grim">
    <gc-health-bar value="50"></gc-health-bar>
</div>
```

### React interop

Web Components work in React 19+ natively. For React 18 use `ref` callbacks to set complex properties:

```tsx
<gc-hotbar ref={el => { if (el) el.slots = slots }} slot-size="64" />
```

---

## Examples

Worked examples per category. Every snippet assumes `register()` ran once and the bundled stylesheet is loaded.

### Layout — HUD with corner anchors

```html
<div style="position: relative; width: 100vw; height: 100vh">
    <gc-anchor position="top-left" inset="12px">
        <gc-stack direction="vertical" gap="6px">
            <gc-health-bar value="80" max="100" show-text label="HP"></gc-health-bar>
            <gc-mana-bar value="40" max="100" show-text label="MP"></gc-mana-bar>
        </gc-stack>
    </gc-anchor>
    <gc-anchor position="top-right" inset="12px">
        <gc-stack direction="horizontal" gap="8px">
            <gc-currency-chip>235</gc-currency-chip>
            <gc-ping-display>32 ms</gc-ping-display>
        </gc-stack>
    </gc-anchor>
    <gc-anchor position="bottom" inset="16px">
        <gc-hotbar id="bar"></gc-hotbar>
    </gc-anchor>
</div>
```

Each `gc-anchor` positions itself absolutely against the nearest positioned ancestor. Combine with `gc-safe-area` on consoles/mobile.

### Layout — responsive grid

```html
<gc-grid columns="3" gap="8px" cell-size="160px">
    <gc-panel>One</gc-panel>
    <gc-panel>Two</gc-panel>
    <gc-panel>Three</gc-panel>
</gc-grid>
```

### Resource bars — full HUD strip

```html
<gc-stack direction="vertical" gap="4px">
    <gc-health-bar  value="62" max="100" ghost="80" segments="4" show-text label="HP"></gc-health-bar>
    <gc-mana-bar    value="30" max="100" segments="3" label="MP"></gc-mana-bar>
    <gc-stamina-bar value="90" max="100" label="ST"></gc-stamina-bar>
    <gc-buff-bar id="buffs"></gc-buff-bar>
</gc-stack>
<script type="module">
    document.getElementById('buffs').buffs = [
        { id: 'haste', icon: '⚡', duration: 12 },
        { id: 'shield', icon: '🛡', duration: 5 }
    ]
</script>
```

`ghost` paints a translucent overlay between `value` and `ghost` — use it to preview incoming damage:

```ts
healthBar.value = hp
healthBar.ghost = hp - predictedHit  // ghost shows where the bar will land
```

### Boss bar with stage segments

```html
<gc-boss-bar value="73" max="100" segments="4" show-text label="ANCIENT WYRM"></gc-boss-bar>
```

### Buttons & menus — pause menu

```html
<gc-pause-menu>
    <gc-menu-item label="Resume" hotkey="R" selected></gc-menu-item>
    <gc-menu-item label="Settings" hotkey="S"></gc-menu-item>
    <gc-menu-item label="Quit" hotkey="Q"></gc-menu-item>
</gc-pause-menu>
<script type="module">
    document.querySelectorAll('gc-menu-item').forEach(el => {
        el.addEventListener('select', e => onMenu(e.detail.label))
    })
</script>
```

`select` fires on click, Enter, or Space. Items expose `selected` / `disabled` attributes plus a `hotkey` glyph.

### Inventory grid + tooltip

```html
<gc-inventory-grid id="bag" columns="8" slot-size="64"></gc-inventory-grid>
<gc-item-tooltip id="tip" hidden></gc-item-tooltip>

<script type="module">
    const bag = document.getElementById('bag')
    const tip = document.getElementById('tip')
    bag.items = inventory.map(it => ({ id: it.uid, name: it.name, icon: it.icon, qty: it.qty, rarity: it.rarity }))

    bag.addEventListener('select', e => {
        if (e.detail.item) {
            tip.item = e.detail.item
            tip.hidden = false
            useItem(e.detail.item)
        } else {
            tip.hidden = true
        }
    })
</script>
```

`InventoryGrid` emits a single `select` event (`{ item, index }`) on slot click. To preview on hover, listen on the child `gc-item-slot` elements with `mouseenter`/`mouseleave`.

### Hotbar bound to game state

```ts
import type { Hotbar, InventoryItem } from '@toolcase/game-components'
import { State } from '@toolcase/base'

const hud = new State<{ slots: { item: InventoryItem | null, hotkey: string }[] }>({
    slots: [
        { item: { id: 'sword', name: 'Sword', icon: '⚔️' }, hotkey: '1' },
        { item: { id: 'potion', name: 'Potion', icon: '🧪', qty: 3 }, hotkey: '2' },
        { item: null, hotkey: '3' }
    ]
})

const bar = document.querySelector<Hotbar>('gc-hotbar')!
hud.on('state.slots', slots => { bar.slots = slots })
bar.slots = hud.get().slots!
bar.addEventListener('select', e => activate(e.detail.item, e.detail.index))
```

### Settings rows — graphics panel

```html
<gc-stack direction="vertical" gap="6px">
    <gc-graphics-preset-picker preset="high"></gc-graphics-preset-picker>
    <gc-fps-cap-select value="60"></gc-fps-cap-select>
    <gc-fov-slider value="90" min="60" max="120"></gc-fov-slider>
    <gc-vsync-toggle checked></gc-vsync-toggle>
    <gc-fullscreen-toggle></gc-fullscreen-toggle>
    <gc-reset-to-defaults></gc-reset-to-defaults>
</gc-stack>
```

Each row dispatches a `change` event with the new value:

```ts
document.querySelectorAll('[gc-]').forEach(el => {
    el.addEventListener('change', e => settings.apply(el.tagName, e.detail.value))
})
```

### Dialogs — confirm before quit

```html
<gc-confirm-dialog
    id="quit"
    title="Leave game?"
    message="Unsaved progress will be lost."
    confirm-label="Quit"
    cancel-label="Stay">
</gc-confirm-dialog>
<script type="module">
    const dlg = document.getElementById('quit')
    function ask() {
        dlg.open = true
        dlg.addEventListener('confirm', () => process.exit(0), { once: true })
        dlg.addEventListener('cancel',  () => dlg.open = false, { once: true })
    }
</script>
```

### NPC dialogue with typewriter + branching

```html
<gc-dialogue-box id="d" speaker="Old Man" typewriter="40">
    "The path ahead is treacherous. Will you turn back?"
</gc-dialogue-box>
<gc-stack direction="vertical">
    <gc-menu-item label="Push on" hotkey="1"></gc-menu-item>
    <gc-menu-item label="Turn back" hotkey="2"></gc-menu-item>
</gc-stack>
```

`typewriter` is the chars/sec rate. The box exposes `skip()` and `complete` events.

### HUD — combat feedback

```html
<gc-crosshair></gc-crosshair>
<gc-hit-marker id="hit"></gc-hit-marker>
<gc-damage-number id="dmg"></gc-damage-number>
<gc-combo-counter id="combo" value="3"></gc-combo-counter>
<gc-screen-flash id="flash"></gc-screen-flash>

<script type="module">
    function onHit(amount, x, y, isCrit) {
        document.getElementById('hit').show(isCrit ? 'crit' : 'normal')
        document.getElementById('dmg').show(amount, x, y, { crit: isCrit })
        if (isCrit) document.getElementById('flash').flash('#fff', 80)
    }
</script>
```

### Lobby + party panels

```html
<gc-stack direction="horizontal" gap="12px">
    <gc-party-panel id="party"></gc-party-panel>
    <gc-chat-window id="chat"></gc-chat-window>
</gc-stack>

<script type="module">
    document.getElementById('party').members = [
        { id: 'p1', name: 'You', level: 24, role: 'tank' },
        { id: 'p2', name: 'Mira', level: 22, role: 'healer' }
    ]
</script>
```

### Screens — game over → results

```html
<gc-game-over-screen id="over" hidden>
    <gc-stat-row label="Time" value="04:32"></gc-stat-row>
    <gc-stat-row label="Score" value="12,400"></gc-stat-row>
    <gc-stat-row label="Kills" value="38"></gc-stat-row>
</gc-game-over-screen>
<script type="module">
    function showGameOver(stats) {
        const screen = document.getElementById('over')
        screen.hidden = false
        screen.addEventListener('continue', () => location.reload(), { once: true })
    }
</script>
```

### Map — minimap with markers

```html
<gc-minimap
    id="mini"
    world-x="0" world-y="0"
    world-width="2048" world-height="2048"
    size="200"
    background-image="/maps/region01.png">
</gc-minimap>
```

```ts
import type { Minimap, MinimapMarker } from '@toolcase/game-components'

const mini = document.getElementById('mini') as Minimap
mini.markers = [
    { id: 'objective', x: 1200, y: 480, color: '#e8a23a', size: 10 },
    { id: 'camp',      x: 640,  y: 2000, color: '#5fa84a' }
] satisfies MinimapMarker[]

mini.rotation = player.heading           // rotates the surface, player stays centered
```

`Minimap` is purely data-driven (`markers` array). The standalone `gc-objective-marker` / `gc-waypoint-marker` tags are full-screen world markers, not minimap children — render them directly over the viewport.

### Effects & overlays — death vignette

```ts
import type { VignetteOverlay } from '@toolcase/game-components'
const vignette = document.querySelector<VignetteOverlay>('gc-vignette-overlay')!
function onDamage(hpPct: number) {
    vignette.intensity = 1 - hpPct       // ramps in red as HP drops
}
```

---

## Theming

Two layers of CSS custom properties:

1. **`--fg-*`** — the global fantasy palette set on `:root` by `style/themes/_fantasy.scss`. Components reference these everywhere; reskinning the whole library means overriding this layer.
2. **`--gc-*`** — per-component knobs (e.g. `--gc-transition-wipe-duration`, `--gc-kill-feed-killer-color`). Each is declared with a `--fg-*` fallback, so you can either override a single component or restyle the entire palette.

Override either layer on `:root` (global) or on a scoped ancestor (per area, e.g. inside a modal).

### `--fg-*` palette (36 tokens)

**Surfaces & frames** — dark wood/leather + dark ink for shadow text.

| Token | Default | Use |
|-------|---------|-----|
| `--fg-ink` | `#1a140d` | deep shadow text/outline |
| `--fg-ink-2` | `#221912` | secondary deep ink |
| `--fg-leather` | `#2a1f14` | base panel/frame |
| `--fg-leather-2` | `#3a2a1c` | raised surface |
| `--fg-leather-3` | `#4a3422` | highlighted surface |

**Parchment** — primary readable text + dim variants.

| Token | Default | Use |
|-------|---------|-----|
| `--fg-parch` | `#e8dcc4` | primary text on dark |
| `--fg-parch-2` | `#d6c5a3` | secondary text |
| `--fg-parch-3` | `#b8a47e` | tertiary text |
| `--fg-parch-dim` | `#8b7a5e` | muted/disabled text |

**Metals** — accents, currency, frames.

| Token | Default | Use |
|-------|---------|-----|
| `--fg-gold` | `#c9a961` | accent / currency |
| `--fg-gold-bright` | `#f0d27a` | hover / highlight on gold |
| `--fg-gold-deep` | `#8b6f3a` | pressed / shadow on gold |
| `--fg-gold-shadow` | `#5a4422` | drop-shadow under gold |
| `--fg-bronze` | `#8b6f3a` | secondary metal |
| `--fg-copper` | `#a06a3a` | tertiary metal |
| `--fg-silver` | `#c5cfd6` | cool metal accent |

**Resources** — bar fills, status colours.

| Token | Default | Use |
|-------|---------|-----|
| `--fg-blood` | `#a8302a` | HP bar |
| `--fg-blood-bright` | `#d44a3a` | HP highlight |
| `--fg-mana` | `#3a6cc9` | mana bar |
| `--fg-mana-bright` | `#5a8cf0` | mana highlight |
| `--fg-stamina` | `#6f9f3a` | stamina bar |
| `--fg-stamina-bright` | `#9fc55a` | stamina highlight |
| `--fg-arcane` | `#8a4ec9` | arcane resource |
| `--fg-arcane-bright` | `#b878e8` | arcane highlight |

**Damage / element types.**

| Token | Default |
|-------|---------|
| `--fg-poison` | `#6fb04a` |
| `--fg-fire` | `#e07330` |
| `--fg-frost` | `#5fb8d4` |

**Rarity** — loot tier colours (used by `gc-loot-list`, `gc-ability-card`, etc.).

| Token | Default |
|-------|---------|
| `--fg-common` | `#9c9489` |
| `--fg-uncommon` | `#5fa84a` |
| `--fg-rare` | `#4a7fcf` |
| `--fg-epic` | `#a44dd0` |
| `--fg-legendary` | `#e8a23a` |
| `--fg-mythic` | `#e04d6a` |

**Typography** — font stacks.

| Token | Default | Use |
|-------|---------|-----|
| `--fg-display` | `'Cinzel', 'Trajan Pro', Georgia, serif` | titles, headings |
| `--fg-body` | `'EB Garamond', Georgia, 'Times New Roman', serif` | body copy |
| `--fg-mono` | `'JetBrains Mono', 'Ubuntu Mono', Consolas, monospace` | numbers, codes |

### Reskinning

```css
:root {
    /* swap the whole palette to a sci-fi colourway */
    --fg-leather: #14202b;
    --fg-leather-2: #1d2f3f;
    --fg-leather-3: #284054;
    --fg-parch: #cfe6ff;
    --fg-parch-2: #98bfde;
    --fg-gold: #00ffd1;
    --fg-gold-bright: #5cffe5;
    --fg-blood: #ff3366;
    --fg-blood-bright: #ff6b8a;
    --fg-mana: #00aaff;
    --fg-display: 'Orbitron', 'Audiowide', sans-serif;
    --fg-body: 'Rajdhani', 'Roboto', sans-serif;
}
```

Or scope the override:

```css
.theme-parchment {
    --fg-leather: #f5e6c8;
    --fg-leather-2: #ecd9b3;
    --fg-parch: #3a2a14;
}
```

```html
<div class="theme-parchment">
    <gc-pause-menu>...</gc-pause-menu>
</div>
```

### Component-level knobs (`--gc-*`)

Each `--gc-*` variable in component SCSS is declared with a `--fg-*` fallback — `var(--gc-kill-feed-killer-color, var(--fg-gold-bright))`. Override the `--gc-*` token to retune one component without touching the palette:

```css
gc-kill-feed {
    --gc-kill-feed-killer-color: #ff00aa;
}

gc-transition-wipe {
    --gc-transition-wipe-duration: 800ms;
}
```

Inspect the SCSS partial for each component (`game-components/style/components/_<name>.scss`) for the full set of `--gc-*` knobs available on it.

---

## Framework integration

### React (18+)

Use refs for non-string props. React 19 lets you set them as attributes directly.

```tsx
import { useEffect, useRef } from 'react'
import '@toolcase/game-components/style.css'
import { register, type Hotbar } from '@toolcase/game-components'
register()

export function HotbarBinding({ slots, onSelect }: Props) {
    const ref = useRef<Hotbar>(null)
    useEffect(() => { if (ref.current) ref.current.slots = slots }, [slots])
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const fn = (e: Event) => onSelect((e as CustomEvent).detail)
        el.addEventListener('select', fn)
        return () => el.removeEventListener('select', fn)
    }, [onSelect])
    return <gc-hotbar ref={ref} slot-size="64" />
}
```

### Vue 3

Web components work natively — declare them as custom in `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
    plugins: [vue({ template: { compilerOptions: { isCustomElement: t => t.startsWith('gc-') } } })]
})
```

```vue
<template>
    <gc-health-bar :value="hp" :max="hpMax" show-text label="HP" />
    <gc-hotbar ref="bar" />
</template>
<script setup lang="ts">
    import { onMounted, ref } from 'vue'
    import { register } from '@toolcase/game-components'
    register()
    const bar = ref<HTMLElement | null>(null)
    onMounted(() => { if (bar.value) (bar.value as any).slots = slots })
</script>
```

### Phaser (HTMLFeature)

Embed game-components into a `phaser-plus` `HTMLFeature` overlay:

```ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import { register } from '@toolcase/game-components'
register()

export class HUD extends HTMLFeature {
    onCreate() {
        this.node.innerHTML = `
            <gc-anchor>
                <gc-stack slot="top-left" direction="vertical" gap="4px">
                    <gc-health-bar id="hp" value="100" max="100" show-text></gc-health-bar>
                    <gc-mana-bar id="mp" value="50" max="50" show-text></gc-mana-bar>
                </gc-stack>
            </gc-anchor>
        `
    }
    setHP(value: number) {
        ;(this.node.querySelector('#hp') as any).value = value
    }
}
```

---

## Notes

- Peer dep: `@toolcase/base` `3.x.x`.
- Bundle is `sideEffects: ['*.css', 'lib/index.main.js', 'lib/index.module.js']` — importing the entry registers tag-name globals; only the CSS import has visual side effects.
- All components extend `HTMLElement` directly (no base class beyond `ResourceBarBase` and `SettingRowBase`).
- Render strategy: `connectedCallback` + per-attribute `attributeChangedCallback`. Mutating attributes is cheap; rapid mutation (>60fps) should batch via JS properties (e.g. `el.value = …`, `el.items = …`).

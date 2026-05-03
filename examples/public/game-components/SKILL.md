---
name: game-components
description: Use when building game UI with @toolcase/game-components — framework-free HTML5 Web Components (`gc-*` custom elements, Shadow DOM, no runtime libs). Covers 134 components across layout, HUDs, menus, inventories, dialogs, settings, overlays, social/lobby, screens, and minimap/markers — drop into any framework or vanilla page.
---

# game-components — API Reference

Vanilla Web Components for game UIs. No framework, no runtime deps beyond `@toolcase/base`. Every component registers under a `gc-*` tag and is consumable from React, Vue, Svelte, or plain HTML.

```ts
import { register } from '@toolcase/game-components'
import '@toolcase/game-components/style.css'

register() // registers all 134 custom elements via customElements.define
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
- **Styling**: bundled CSS at `@toolcase/game-components/style.css`. Components read CSS variables (e.g. `--gc-title-size`, `--gc-bar-fill`) — override in your stylesheet for theming.
- **No framework**: all rendering is `Shadow DOM` + `innerHTML` driven. Safe to nest, slot, and reparent like any HTMLElement.

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
| `gc-anchor` | `Anchor` | — | Positions children at corners/edges via slots/CSS. |
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
| `gc-particle-emitter` | `ParticleEmitter` |
| `gc-shake-container` | `ShakeContainer` (camera-shake wrapper) |
| `gc-screen-flash` | `ScreenFlash` |
| `gc-transition-wipe` | `TransitionWipe` |

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
| `gc-dialogue-box` | `DialogueBox` | NPC dialogue / typewriter text |
| `gc-combo-box` | `ComboBox` | dropdown input |
| `gc-toggle` | `Toggle` | bool switch (atomic) |
| `gc-check` | `Check` | checkbox |
| `gc-key-binder` | `KeyBinder` | capture next key/button press |
| `gc-report-player-dialog` | `ReportPlayerDialog` | moderation modal |
| `gc-invite-toast` | `InviteToast` | transient invite popup |

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

`register()` registers all 134. To register one, import the class and call `customElements.define` directly:

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
    --gc-bar-fill: #6f1d1b;
    --gc-title-size: 32px;
    --gc-panel-bg: #1a1a1a;
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

## Notes

- Peer dep: `@toolcase/base` 2.x.
- Bundle is `sideEffects: ['*.css', 'lib/index.main.js', 'lib/index.module.js']` — importing the entry registers tag-name globals; only the CSS import has visual side effects.
- All components extend `HTMLElement` directly (no base class beyond `ResourceBarBase` and `SettingRowBase`).
- Render strategy is Shadow DOM + per-attribute `attributeChangedCallback`. Mutating attributes is cheap; rapid mutation (>60fps) should batch via JS properties.

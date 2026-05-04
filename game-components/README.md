# @toolcase/game-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/game-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/game-components)

🎮 **Framework-free** Web Components for game UIs — HUDs, menus, dialogs, inventories, minimaps, settings screens, and more. Built with vanilla **HTML5 Custom Elements** and **Shadow DOM**. No React, no Vue, no runtime libraries — just standard browser APIs.

📖 Live demos: **[toolcase.kalevski.dev/game-components](https://toolcase.kalevski.dev/game-components)**

## Why Web Components for game UI?

- **Drop-in anywhere** — works in plain HTML, React, Vue, Svelte, Angular, or your custom engine.
- **Style isolation** — Shadow DOM keeps game CSS out of your overlay and vice versa.
- **No bundle bloat** — components are vanilla classes; tree-shake what you don't use.
- **Works with `<canvas>`** — drop them on top of a Phaser / PixiJS / Three.js canvas.

## Install

```bash
npm install @toolcase/game-components
```

### Peer dependencies

- `@toolcase/base ^3.x`

## Setup

```ts
import { register } from '@toolcase/game-components'
import '@toolcase/game-components/style.css'

register() // registers every gc-* element on window.customElements
```

After `register()` runs, you can use the elements in any HTML — JSX, template literals, frameworks, plain markup.

## Usage examples

### Plain HTML

```html
<gc-health-bar value="78" max="100"></gc-health-bar>
<gc-ammo-counter current="6" reserve="42"></gc-ammo-counter>
<gc-crosshair style="--crosshair-color: #00ff88;"></gc-crosshair>
```

### React

```tsx
function GameHUD({ hp, ammo }) {
    return (
        <>
            <gc-health-bar value={hp} max={100} />
            <gc-ammo-counter current={ammo.current} reserve={ammo.reserve} />
        </>
    )
}
```

> If you're on TypeScript + React, declare `gc-*` in your global JSX namespace, or cast through `as any` until you generate types.

### Vue

```vue
<gc-pause-menu></gc-pause-menu>
<gc-volume-slider :value="volume" @change="onVolume"></gc-volume-slider>
```

### On top of a canvas

```html
<style>
    .game { position: relative }
    .game gc-crosshair { position: absolute; inset: 0 }
</style>

<div class="game">
    <canvas id="phaser"></canvas>
    <gc-crosshair></gc-crosshair>
    <gc-health-bar value="80"></gc-health-bar>
    <gc-minimap></gc-minimap>
</div>
```

## Available components

The library ships **130+ ready-made elements** covering the full game UI surface:

| Category | Examples |
|----------|----------|
| **Resource bars** | `gc-health-bar`, `gc-mana-bar`, `gc-stamina-bar`, `gc-ammo-counter`, `gc-boss-bar`, `gc-buff-bar` |
| **Crosshair / damage / combat feedback** | `gc-crosshair`, `gc-hit-marker`, `gc-damage-number`, `gc-combo-counter`, `gc-kill-feed`, `gc-screen-flash` |
| **Heads-up display** | `gc-compass-bar`, `gc-compass-rose`, `gc-minimap`, `gc-objective-marker`, `gc-waypoint-marker`, `gc-ping-display`, `gc-debug-overlay`, `gc-network-status-icon` |
| **Inventory & items** | `gc-item-slot`, `gc-item-tooltip`, `gc-item-compare`, `gc-hotbar`, `gc-inventory-grid`, `gc-equipment-doll`, `gc-loot-list`, `gc-loot-popup`, `gc-rarity-chip`, `gc-currency-chip`, `gc-currency-display` |
| **Player / social** | `gc-player-card`, `gc-player-frame`, `gc-portrait`, `gc-friends-list`, `gc-mute-list`, `gc-party-panel`, `gc-guild-panel`, `gc-chat-window`, `gc-invite-toast`, `gc-report-player-dialog` |
| **Menus & screens** | `gc-main-menu`, `gc-pause-menu`, `gc-pause-screen`, `gc-loading-screen`, `gc-loading-overlay`, `gc-title-screen`, `gc-result-screen`, `gc-game-over-screen`, `gc-victory-screen`, `gc-stats-screen`, `gc-matchmaking-screen` |
| **Dialogues & prompts** | `gc-dialogue-box`, `gc-confirm-dialog`, `gc-interact-prompt`, `gc-press-any-key` |
| **Progression & quests** | `gc-quest-tracker`, `gc-skill-tree`, `gc-skill-bar`, `gc-ability-card`, `gc-perk-picker`, `gc-codex`, `gc-journal`, `gc-achievement-list`, `gc-battle-pass` |
| **Economy** | `gc-shop-panel`, `gc-crafting-panel`, `gc-radial-wheel` |
| **Lobby & matchmaking** | `gc-lobby`, `gc-character-create`, `gc-character-select`, `gc-level-select`, `gc-save-slot-list` |
| **Settings** | `gc-fov-slider`, `gc-deadzone-slider`, `gc-volume-slider`, `gc-mouse-sensitivity`, `gc-fps-cap-select`, `gc-graphics-preset-picker`, `gc-vsync-toggle`, `gc-fullscreen-toggle`, `gc-invert-axis-toggle`, `gc-brightness-calibration`, `gc-controls-rebind-list`, `gc-key-binder`, `gc-controller-layout-preview`, `gc-reset-to-defaults`, `gc-settings-category-list` |
| **Layout** | `gc-stack`, `gc-grid`, `gc-anchor`, `gc-panel`, `gc-panel-header`, `gc-divider`, `gc-tab-bar`, `gc-page-indicator`, `gc-safe-area`, `gc-aspect-ratio-box`, `gc-letterbox-bars` |
| **Typography & decoration** | `gc-title`, `gc-subtitle`, `gc-eyebrow`, `gc-lore-text`, `gc-scroll-text`, `gc-version-label`, `gc-icon-badge`, `gc-gilded-frame`, `gc-rune-corner`, `gc-artboard-backdrop`, `gc-vignette-overlay`, `gc-blur-overlay` |
| **Buttons & inputs** | `gc-metal-button`, `gc-nav-button`, `gc-menu-item`, `gc-list-row`, `gc-toggle`, `gc-toggle-row`, `gc-select-row`, `gc-stat-row`, `gc-key`, `gc-gamepad-button-prompt`, `gc-platform-icon`, `gc-check`, `gc-combo-box` |
| **Effects** | `gc-shake-container`, `gc-transition-wipe`, `gc-particle-emitter`, `gc-cooldown-badge`, `gc-circular-progress` |
| **Vehicle / driving HUD** | `gc-speedometer` |
| **Credits / legal** | `gc-credits-list`, `gc-credits-scroll`, `gc-legal-screen` |
| **Buffs** | `gc-buff-icon` |

Full per-component API (attributes, slots, events, CSS variables) lives at [toolcase.kalevski.dev/game-components/SKILL.md](https://toolcase.kalevski.dev/game-components/SKILL.md).

## Theming

Each component uses Shadow DOM, so global CSS doesn't leak in or out. Customize via **CSS custom properties** on the host:

```css
gc-health-bar {
    --hp-fill: linear-gradient(90deg, #ff3a3a, #ff8a3a);
    --hp-bg: rgba(0, 0, 0, .6);
    --hp-height: 18px;
}

gc-crosshair {
    --crosshair-color: #00ff88;
    --crosshair-thickness: 2px;
}
```

Or rebuild from SCSS:

```scss
$panel-bg: #0c0e14;
@import '@toolcase/game-components/style/index.scss';
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)

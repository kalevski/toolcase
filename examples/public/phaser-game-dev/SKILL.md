---
name: phaser-game-dev
description: Use when scaffolding or extending a Phaser 4 game built on top of `@toolcase/phaser-plus`, with `@toolcase/game-components` as the canonical UI toolkit (HUDs, menus, inventories, dialogs, screens). Defines workspace layout (scenes/ + features/ + ui/ + prefabs/), layering rules (Scene → Feature/HTMLFeature → Prefab GameObject), boot sequence with `installEffects` + `register()` + `style.css`, lifecycle contracts (`onInit/onLoad/onCreate/onUpdate/onDestroy` for scenes, `onCreate/onUpdate/onDestroy` for features, `onCreate/onAdd/onUpdate/onRemove/onDestroy` for game objects), the FeatureRegistry pub-sub bus, GameObjectPool spawning, the `dom: { createContainer: true }` HTMLFeature requirement, and the rule that HTMLFeatures compose `gc-*` Web Components instead of hand-rolled markup. Apply when adding a scene, feature, UI overlay, prefab, or scaffolding a new Phaser game workspace.
---

# phaser-game-dev — Architecture Reference

Opinionated blueprint for Phaser 4 games. Layered, registry-driven, ESM. Every scene is a `Scene` subclass; every gameplay system lives in `features/`; every DOM/HUD overlay lives in `ui/`; every visible entity is a prefab in `prefabs/` extending `GameObject` (or `GameObject2D`, or a project-local `CustomGameObject` base). Deviation = bug.

Stack baseline:

- Phaser 4 (`phaser ^4.x`).
- `@toolcase/phaser-plus` ^1.x — **required** runtime layer. Provides `Scene`, `Feature`, `HTMLFeature`, `FeatureRegistry`, `GameObject`, `GameObject2D`, `Layer`, `ObjectLayer`, `GameObjectPool`, `FlowEngine`, `Engine`, `ServiceRegistry`, plus `effects/`, `cinema/`, `input/`, `ai/`, `flow/`, `debugger/`, `perspective2d/` re-exports.
- `@toolcase/game-components` ^3.x — **required** UI toolkit. 134 framework-free `gc-*` Web Components (Shadow DOM) for HUDs, menus, inventories, dialogs, settings, screens, minimaps. Every `HTMLFeature` composes these instead of hand-rolling markup.
- `@toolcase/base` ^2.x — peer of `phaser-plus`. Helpers (`generateId`, `Cache`, `EventEmitter`, etc.) and data structures.
- `@toolcase/logging` ^2.x — peer of `phaser-plus`. Scoped loggers wired through `Engine`.
- TypeScript `strict`, ESM (`"type": "module"`), Node 20+.
- Vite for dev/build (the canonical tooling — Webpack works but is out of scope here).

Required install before anything else:

```bash
npm install phaser @toolcase/phaser-plus @toolcase/game-components @toolcase/base @toolcase/logging
```

If you want shader effects on `GameObject` instances, also import and call `installEffects(game)` immediately after `new Game(config)` (see Boot below). Without it, `gameObject.effects.add(...)` is a no-op.

`@toolcase/game-components` requires a one-time `register()` call at boot to define all 134 custom elements globally, plus the bundled stylesheet (`@toolcase/game-components/style.css`). After that, any `HTMLFeature` can author UI with `gc-*` tags directly inside `this.node.innerHTML`.

---

## Workspace layout

```
src/
├── boot.ts              # Game config + new Game() + installEffects(game)
├── scenes/
│   ├── BootScene.ts     # asset preload, then goTo('main')
│   ├── MainScene.ts
│   └── GameOverScene.ts
├── features/            # Scene-lifetime gameplay systems (Feature subclasses)
│   ├── DayNightCycleFeature.ts
│   ├── SpawnerFeature.ts
│   └── PlayerControlFeature.ts
├── ui/                  # DOM overlays (HTMLFeature subclasses)
│   ├── HUDFeature.ts
│   ├── PauseMenuFeature.ts
│   └── DialogFeature.ts
├── prefabs/             # Visible entities (GameObject / GameObject2D / CustomGameObject)
│   ├── CustomGameObject.ts   # project-local base — optional
│   ├── Player.ts
│   ├── Enemy.ts
│   └── Pickup.ts
├── services/            # Game-lifetime singletons (ServiceRegistry)
│   ├── SaveService.ts
│   └── AudioService.ts
├── data/                # Static config tables, level definitions, balance numbers
└── assets/              # Images, atlases, audio, JSON — referenced by BootScene
public/
└── (built assets only — Vite copies as-is)
index.html               # Single mount point with <div id="game">
vite.config.ts
tsconfig.json
package.json
```

Hard rules:

- **One Phaser game instance per process.** Created in `boot.ts`, never re-created.
- **`scenes/` only contains `Scene` subclasses.** No gameplay logic, no DOM, no asset constants.
- **`features/` only contains `Feature` subclasses.** No DOM, no `document.*` access. If it touches DOM, it belongs in `ui/`.
- **`ui/` only contains `HTMLFeature` subclasses.** Each owns one `<div>` overlay. No game logic — fan-out events to `features/`.
- **`prefabs/` only contains GameObject subclasses.** No `Phaser.Scene` subclasses. No `register(...)` calls.
- **`services/` is game-lifetime.** Survives scene transitions. Resolved through `scene.engine.services`.

---

## Layering rules

```
Scene  ──registers──▶  Feature ◀─emits/listens─▶ Feature
   │                      │
   │                      ├─▶ adds Prefab GameObjects (via Layer / ObjectLayer / pool)
   │                      │
   │                      └─▶ HTMLFeature (UI overlay)
   │
   └──update()──▶ Phaser physics + GameObjects + Features (in that order)
```

Allowed dependencies:

- **Scene → Feature, HTMLFeature, Prefab.** A scene may construct, register, and reference any feature or prefab.
- **Feature → Feature, Prefab, Service.** A feature may read/write other features through `scene.features.get(key)` or talk via `scene.features.emit(...)`. Avoid direct cross-feature method calls if a pub-sub event is sufficient.
- **HTMLFeature → Feature.** UI dispatches user intent to gameplay features via the registry bus, then re-renders on event echoes. UI must NOT mutate game state directly.
- **Prefab → nothing in `features/` or `ui/`.** A prefab may read `this.scene` for `add`/`physics` factory access, but it must NOT call `scene.features.get(...)` or know which features exist. Prefabs are dumb — features drive them.
- **Service → Service only.** Services are leaves.

Forbidden:

- Prefab importing from `features/` or `ui/`.
- HTMLFeature mutating prefab state directly (e.g. `player.x = ...`).
- Scene running gameplay logic in `onUpdate` (delegate to features).
- Scene knowing the DOM (no `document.*` in scene code).
- Two scenes sharing a feature instance (features are scene-scoped — re-register per scene).

---

## Boot sequence

`src/boot.ts`:

```ts
import 'phaser'
import { Game, AUTO, Scale } from 'phaser'
import { installEffects } from '@toolcase/phaser-plus'
import { register as registerGameComponents } from '@toolcase/game-components'
import '@toolcase/game-components/style.css'
import { BootScene } from './scenes/BootScene'
import { MainScene } from './scenes/MainScene'
import { GameOverScene } from './scenes/GameOverScene'

registerGameComponents()        // REQUIRED before any HTMLFeature mounts gc-* elements

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game',
    backgroundColor: '#0a0e14',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 1280,
        height: 720
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    dom: {
        createContainer: true   // REQUIRED if any HTMLFeature is used
    },
    scene: [BootScene, MainScene, GameOverScene]
}

const game = new Game(config)
installEffects(game)            // REQUIRED if any GameObject uses .effects.add(...)

export default game
```

Hard rules:

- `dom.createContainer: true` is **mandatory** if any `HTMLFeature` exists. Without it, `HTMLFeature` constructor throws.
- `installEffects(game)` runs **once, after `new Game(config)`**, never inside a scene.
- `register()` from `@toolcase/game-components` runs **once at module top-level**, before `new Game(config)`. Calling it twice is a no-op (custom elements are idempotent), but registering inside a scene risks racing the first `HTMLFeature.onCreate`.
- The bundled stylesheet `@toolcase/game-components/style.css` must be imported once (boot.ts is the canonical place). Without it, `gc-*` elements render unstyled.
- Scenes are listed in boot order. The first scene auto-starts.
- Never construct `new Phaser.Scene(...)` directly — register the class on `config.scene`.

---

## Scene contract

`Scene` extends `Phaser.Scene` and adds five overridable lifecycle hooks plus four pre-wired registries. Override hooks; do **not** override Phaser's `init`/`preload`/`create`/`update` directly.

```ts
import { Scene } from '@toolcase/phaser-plus'
import { DayNightCycleFeature } from '../features/DayNightCycleFeature'
import { HUDFeature } from '../ui/HUDFeature'
import { Player } from '../prefabs/Player'

export class MainScene extends Scene {

    constructor() {
        super('main')           // scene key — used by goTo('main')
    }

    onLoad() {
        // Phaser preload phase. Queue assets only.
        this.load.atlas('characters', 'assets/characters.png', 'assets/characters.json')
        this.load.tilemapTiledJSON('level1', 'assets/level1.json')
    }

    onCreate() {
        // Build the world, register features, register UI, spawn prefabs.
        this.pool.add('player', Player)

        this.features.register('dayNight', DayNightCycleFeature)
        this.features.register('hud', HUDFeature)

        this.pool.spawn<Player>('player', 640, 360)
    }

    onUpdate(time: number, delta: number) {
        // Per-frame work that does NOT belong to a feature.
        // 99% of the time this stays empty — features handle everything.
    }

    onDestroy() {
        // Resource cleanup that features can't own.
    }
}
```

Available on every Scene subclass (provided by `phaser-plus`):

| Property              | Type                | Purpose                                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------------------ |
| `this.engine`         | `Engine`            | Per-scene engine handle. Wraps logger factory + service registry.        |
| `this.services`       | `ServiceRegistry`   | Game-lifetime singletons (audio, save, analytics).                       |
| `this.features`       | `FeatureRegistry`   | Scene-lifetime feature container + broadcast bus.                        |
| `this.flow`           | `FlowEngine`        | Timers, jobs, debounced events, state machines, behavior trees.          |
| `this.pool`           | `GameObjectPool`    | Pooled GameObject factory. Register prefab classes, spawn instances.     |

Lifecycle order on scene start:

1. Phaser fires `init(payload)` → `phaser-plus` calls `beforeInit()` → `onInit()`.
2. Phaser fires `preload()` → calls `onLoad()`.
3. Phaser fires `create()` → calls `onCreate()`.
4. Each frame: Phaser physics → `feature.onUpdate(time, delta)` for every registered feature → `gameObject.onUpdate(time, delta)` for every direct child GameObject → scene's `onUpdate(time, delta)`.
5. On `goTo`/`restart`/shutdown: each feature's `preDestroy()` then `onDestroy()`, then scene's `onDestroy()`.

Scene-to-scene navigation:

```ts
this.goTo('gameover', { score: 1234 })       // start another scene with payload
this.restart({ checkpoint: 3 })              // reload current scene
this.pause(); this.resume()                  // freeze/unfreeze updates
const data = this.payload                    // read payload from previous goTo
```

---

## Feature contract — `features/`

`Feature` is the base class for **every gameplay system**: spawning, AI, day/night cycle, weather, score, combat resolution, level progression, save autosave, music director. One concept per Feature. Features compose by listening to each other on the registry bus.

```ts
import { Feature } from '@toolcase/phaser-plus'

export const DAY_NIGHT_TICK = 'daynight:tick'
export const DAY_NIGHT_PHASE = 'daynight:phase'

export type DayNightPhase = 'dawn' | 'day' | 'dusk' | 'night'

export class DayNightCycleFeature extends Feature {

    private elapsed = 0
    private phase: DayNightPhase = 'day'
    private overlay!: Phaser.GameObjects.Rectangle

    /** Real seconds for one full in-game day. */
    public dayLengthMs = 120_000

    onCreate() {
        const { width, height } = this.scene.scale
        this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000033, 0)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(1000)
        this.logger.info('day/night cycle started')
    }

    onUpdate(_time: number, delta: number) {
        this.elapsed = (this.elapsed + delta) % this.dayLengthMs
        const t = this.elapsed / this.dayLengthMs
        const next = this.phaseFor(t)
        if (next !== this.phase) {
            this.phase = next
            this.emit(DAY_NIGHT_PHASE, next)
        }
        const darkness = this.darknessFor(t)
        this.overlay.setAlpha(darkness)
        this.emit(DAY_NIGHT_TICK, { t, phase: this.phase, darkness })
    }

    onDestroy() {
        this.overlay.destroy()
    }

    private phaseFor(t: number): DayNightPhase {
        if (t < 0.20) return 'dawn'
        if (t < 0.55) return 'day'
        if (t < 0.70) return 'dusk'
        return 'night'
    }

    private darknessFor(t: number): number {
        // 0 at noon (t≈0.4), peaks at 0.6 around midnight (t≈0.85)
        return 0.6 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t))
    }
}
```

Available on every Feature subclass:

| Member                  | Type                     | Purpose                                                          |
| ----------------------- | ------------------------ | ---------------------------------------------------------------- |
| `this.scene`            | `Scene` (protected)      | Owning scene. Use `this.scene.add.*`, `this.scene.physics.*`.    |
| `this.game`             | `Phaser.Game` (protected)| Root game instance. Rare — prefer `this.scene`.                  |
| `this.key`              | `string`                 | Feature key from `register(key, FeatureClass)`.                  |
| `this.logger`           | `Logger` (protected)     | Scoped logger named after `key`.                                 |
| `this.emit(event, ...)` | method                   | Broadcast on `scene.features` bus. Receivers use `.on(event)`.   |

Lifecycle:

- `onCreate()` — runs immediately after `register(key, ...)`. Build internal state, create Phaser objects, subscribe to other features' events.
- `onUpdate(time, delta)` — runs every frame, after physics, before scene's `onUpdate`.
- `preDestroy()` — runs before destroy chain. Use to remove other features cleanly without re-entrancy issues.
- `onDestroy()` — final cleanup. Unsubscribe, destroy owned GameObjects, null out references.

Pub-sub between features:

```ts
// publisher
this.emit('enemy:killed', { id: enemy.id, points: 100 })

// subscriber (another feature)
onCreate() {
    this.scene.features.on('enemy:killed', this.onKill, this)
}
onDestroy() {
    this.scene.features.off('enemy:killed', this.onKill, this)
}
private onKill = (payload: { id: string; points: number }) => {
    this.score += payload.points
}
```

Reading another feature directly (when pub-sub doesn't fit):

```ts
const dayNight = this.scene.features.get<DayNightCycleFeature>('dayNight')
if (dayNight && dayNight.phase === 'night') {
    /* spawn nocturnal enemy */
}
```

Hard rules:

- **One responsibility per Feature.** `SpawnerFeature` does spawning. `AIFeature` does AI. Don't merge them.
- **Always `off()` in `onDestroy`** if you `on()`-ed in `onCreate`. The bus survives across re-registrations.
- **Never store a reference to another feature in a field at construction time.** Other features may not exist yet. Resolve at use, or wait for an event.
- **Never touch the DOM from a Feature.** Use HTMLFeature for that.

---

## UI contract — `ui/`

`HTMLFeature` extends `Feature` and gives you a single `<div>` overlay (`this.node`) on top of the canvas. Use it for HUDs, menus, dialog boxes, settings panels, debug consoles. **Requires** `dom.createContainer: true` in the game config.

**UI markup is built from `@toolcase/game-components` `gc-*` Web Components.** Hand-rolled `<div>` markup is reserved for layout glue that `gc-*` doesn't already cover. Compose `gc-anchor`, `gc-stack`, `gc-grid` for layout; `gc-health-bar`, `gc-mana-bar`, `gc-buff-bar`, `gc-hotbar`, `gc-minimap`, `gc-objective-marker`, etc. for HUD pieces; `gc-pause-menu`, `gc-confirm-dialog`, `gc-dialogue-box`, `gc-game-over-screen`, `gc-victory-screen` for menus and screens. See `game-components/SKILL.md` for the full catalog.

```ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { HealthBar, ManaBar, MenuItem } from '@toolcase/game-components'
import { DAY_NIGHT_TICK, type DayNightPhase } from '../features/DayNightCycleFeature'

export class HUDFeature extends HTMLFeature {

    private hpEl!: HealthBar
    private mpEl!: ManaBar
    private scoreEl!: HTMLElement
    private phaseEl!: HTMLElement

    onCreate() {
        this.node.innerHTML = `
            <gc-anchor>
                <gc-stack slot="top-left" direction="vertical" gap="6px">
                    <gc-health-bar id="hp" value="100" max="100" segments="4" show-text label="HP"></gc-health-bar>
                    <gc-mana-bar   id="mp" value="50"  max="50"  segments="3" show-text label="MP"></gc-mana-bar>
                </gc-stack>
                <gc-stack slot="top-right" direction="horizontal" gap="8px">
                    <gc-eyebrow>SCORE</gc-eyebrow>
                    <gc-title id="score" size="24">0</gc-title>
                    <gc-eyebrow id="phase">day</gc-eyebrow>
                </gc-stack>
                <gc-menu-item slot="bottom-right" id="pauseBtn" label="Pause" hotkey="P"></gc-menu-item>
            </gc-anchor>
        `
        this.hpEl    = this.node.querySelector<HealthBar>('#hp')!
        this.mpEl    = this.node.querySelector<ManaBar>('#mp')!
        this.scoreEl = this.node.querySelector('#score')!
        this.phaseEl = this.node.querySelector('#phase')!

        this.node.querySelector<MenuItem>('#pauseBtn')!.addEventListener('select', () => {
            this.scene.features.emit('ui:pause-requested')
        })

        this.scene.features.on(DAY_NIGHT_TICK, this.onTick, this)
        this.scene.features.on('score:changed', this.onScore, this)
        this.scene.features.on('player:hp', this.onHp, this)
        this.scene.features.on('player:mp', this.onMp, this)
    }

    onDestroy() {
        this.scene.features.off(DAY_NIGHT_TICK, this.onTick, this)
        this.scene.features.off('score:changed', this.onScore, this)
        this.scene.features.off('player:hp', this.onHp, this)
        this.scene.features.off('player:mp', this.onMp, this)
    }

    private onTick  = (p: { phase: DayNightPhase })          => { this.phaseEl.textContent = p.phase }
    private onScore = (p: { score: number })                 => { this.scoreEl.textContent = String(p.score) }
    private onHp    = (p: { value: number; max: number })    => { this.hpEl.value = p.value; this.hpEl.max = p.max }
    private onMp    = (p: { value: number; max: number })    => { this.mpEl.value = p.value; this.mpEl.max = p.max }
}
```

Key things to note in the example:

- Layout primitives (`gc-anchor`, `gc-stack`) replace ad-hoc CSS positioning.
- Resource bars expose `.value` / `.max` as JS properties — set them, no re-render dance.
- `gc-menu-item` emits a `select` `CustomEvent` (click + Enter + Space + hotkey). The HTMLFeature translates that into a game event on the bus.
- `MenuItem` / `HealthBar` / `ManaBar` types come from `@toolcase/game-components` — `querySelector<HealthBar>` is fully typed via `HTMLElementTagNameMap`.

Available in addition to `Feature` API:

| Member        | Type             | Purpose                                                                       |
| ------------- | ---------------- | ----------------------------------------------------------------------------- |
| `this.node`   | `HTMLDivElement` | Owned overlay div. Class name is `html-feature feature-{key}`. Set innerHTML. |

`preDestroy()` is already implemented by `HTMLFeature` — it removes the node. If you override it, call `super.preDestroy()`.

Hard rules:

- **One overlay per HTMLFeature.** Need two? Register two HTMLFeatures (`hud`, `pauseMenu`).
- **`gc-*` first, custom markup last.** If `@toolcase/game-components` ships a component for what you need (HUD bars, menus, dialogs, inventory grids, screens, minimap), use it. Project-specific glue goes around it.
- **Set complex props in JS, not attributes.** Arrays/objects (`hotbar.slots = [...]`, `lootPopup.items = [...]`, `partyPanel.members = [...]`) must be assigned via JS properties — attributes only carry strings/numbers/booleans.
- **No game state inside UI.** UI reads via events, writes via events. Never mutate prefabs or other features' fields directly.
- **Theme via `--fg-*` / `--gc-*` CSS custom properties** — set them on `:root`, on the `dom.createContainer` div, or scoped to a feature wrapper. Don't fork component SCSS.
- **Don't reskin gc components with `!important` cascades.** Override the documented CSS variables (`--gc-*`, `--fg-*`) instead.
- **Listeners attached to `this.node` children are auto-cleaned** when the node is removed. Listeners attached elsewhere (e.g. `window.addEventListener`) must be removed in `onDestroy`.

---

## UI building blocks — `@toolcase/game-components`

Canonical mapping from common Phaser-game UI needs to `gc-*` components. Each row below assumes `register()` ran in `boot.ts` and the stylesheet is imported.

| Need                       | Components                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------- |
| HUD layout / corners       | `gc-anchor`, `gc-stack`, `gc-grid`, `gc-safe-area`, `gc-aspect-ratio-box`              |
| Resource bars              | `gc-health-bar`, `gc-mana-bar`, `gc-stamina-bar`, `gc-ammo-counter`, `gc-boss-bar`     |
| Buffs / cooldowns          | `gc-buff-bar`, `gc-buff-icon`, `gc-cooldown-badge`, `gc-circular-progress`             |
| Hotbar / abilities         | `gc-hotbar`, `gc-skill-bar`, `gc-ability-card`, `gc-radial-wheel`                      |
| Inventory                  | `gc-inventory-grid`, `gc-item-slot`, `gc-item-tooltip`, `gc-equipment-doll`            |
| Combat feedback            | `gc-crosshair`, `gc-hit-marker`, `gc-damage-number`, `gc-combo-counter`, `gc-screen-flash` |
| Currency / chips           | `gc-currency-chip`, `gc-currency-display`, `gc-rarity-chip`, `gc-icon-badge`           |
| Menus / pause              | `gc-pause-menu`, `gc-main-menu`, `gc-menu-item`, `gc-tab-bar`, `gc-press-any-key`      |
| Dialogs                    | `gc-confirm-dialog`, `gc-dialogue-box`, `gc-loot-popup`, `gc-report-player-dialog`     |
| Settings rows              | `gc-toggle-row`, `gc-select-row`, `gc-fov-slider`, `gc-volume-slider`, `gc-fps-cap-select`, `gc-graphics-preset-picker`, `gc-key-binder`, `gc-controls-rebind-list` |
| Map / nav                  | `gc-minimap`, `gc-objective-marker`, `gc-waypoint-marker`, `gc-compass-bar`, `gc-compass-rose` |
| Overlays                   | `gc-vignette-overlay`, `gc-blur-overlay`, `gc-loading-overlay`, `gc-letterbox-bars`, `gc-transition-wipe` |
| Full screens               | `gc-title-screen`, `gc-loading-screen`, `gc-pause-screen`, `gc-game-over-screen`, `gc-victory-screen`, `gc-result-screen`, `gc-stats-screen` |
| Social / multiplayer       | `gc-chat-window`, `gc-kill-feed`, `gc-lobby`, `gc-party-panel`, `gc-friends-list`, `gc-invite-toast` |
| Player / character         | `gc-character-create`, `gc-character-select`, `gc-player-card`, `gc-portrait`, `gc-level-header` |
| Progression / economy      | `gc-quest-tracker`, `gc-journal`, `gc-codex`, `gc-shop-panel`, `gc-crafting-panel`, `gc-battle-pass` |

For the full catalog (134 components, attributes, events, types), read `game-components/SKILL.md`.

### Pattern: HUD scaffold

```ts
// ui/HUDFeature.ts — see UI contract example above
```

Layout uses `gc-anchor` for corner pinning and `gc-stack` for inner row/column flow. Bars set their `.value` / `.max` as JS properties. Subscribe to gameplay events; do not poll.

### Pattern: pause menu

```ts
// ui/PauseMenuFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { MenuItem } from '@toolcase/game-components'

export class PauseMenuFeature extends HTMLFeature {

    onCreate() {
        this.node.innerHTML = `
            <gc-blur-overlay open>
                <gc-pause-menu>
                    <gc-menu-item label="Resume"  hotkey="R" data-action="resume" selected></gc-menu-item>
                    <gc-menu-item label="Settings" hotkey="S" data-action="settings"></gc-menu-item>
                    <gc-menu-item label="Quit"    hotkey="Q" data-action="quit"></gc-menu-item>
                </gc-pause-menu>
            </gc-blur-overlay>
        `
        this.node.querySelectorAll<MenuItem>('gc-menu-item').forEach(item => {
            item.addEventListener('select', () => {
                const action = item.getAttribute('data-action')!
                this.scene.features.emit(`ui:menu-${action}`)
            })
        })
        this.scene.features.on('ui:pause-requested', this.toggle, this)
    }

    onDestroy() {
        this.scene.features.off('ui:pause-requested', this.toggle, this)
    }

    private toggle = () => {
        const open = this.node.style.display !== 'none'
        this.node.style.display = open ? 'none' : 'block'
        if (open) this.scene.resume(); else this.scene.pause()
    }
}
```

### Pattern: dialogue with branching choices

```ts
// ui/DialogueFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { DialogueBox, MenuItem } from '@toolcase/game-components'

export interface DialogueLine {
    speaker: string
    text: string
    choices?: { id: string; label: string }[]
}

export class DialogueFeature extends HTMLFeature {

    private box!: DialogueBox

    onCreate() {
        this.node.innerHTML = `
            <gc-stack slot="bottom" direction="vertical" gap="8px">
                <gc-dialogue-box id="line" typewriter="40"></gc-dialogue-box>
                <gc-stack id="choices" direction="vertical" gap="4px"></gc-stack>
            </gc-stack>
        `
        this.box = this.node.querySelector<DialogueBox>('#line')!
        this.scene.features.on('dialogue:show',  this.show,  this)
        this.scene.features.on('dialogue:close', this.close, this)
    }

    onDestroy() {
        this.scene.features.off('dialogue:show',  this.show,  this)
        this.scene.features.off('dialogue:close', this.close, this)
    }

    private show = (line: DialogueLine) => {
        this.box.setAttribute('speaker', line.speaker)
        this.box.textContent = line.text
        const choices = this.node.querySelector('#choices')!
        choices.innerHTML = ''
        line.choices?.forEach((c, i) => {
            const item = document.createElement('gc-menu-item') as MenuItem
            item.setAttribute('label', c.label)
            item.setAttribute('hotkey', String(i + 1))
            item.addEventListener('select', () => {
                this.scene.features.emit('dialogue:choice', { id: c.id })
            })
            choices.appendChild(item)
        })
    }

    private close = () => {
        this.node.querySelector('#choices')!.innerHTML = ''
        this.box.textContent = ''
    }
}
```

### Pattern: inventory + tooltip

```ts
// ui/InventoryFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { InventoryGrid, ItemTooltip, InventoryItem } from '@toolcase/game-components'

export class InventoryFeature extends HTMLFeature {

    private grid!: InventoryGrid
    private tip!: ItemTooltip

    onCreate() {
        this.node.innerHTML = `
            <gc-panel header="Inventory">
                <gc-inventory-grid id="bag" rows="6" columns="8"></gc-inventory-grid>
            </gc-panel>
            <gc-item-tooltip id="tip" hidden></gc-item-tooltip>
        `
        this.grid = this.node.querySelector<InventoryGrid>('#bag')!
        this.tip  = this.node.querySelector<ItemTooltip>('#tip')!

        this.grid.addEventListener('item-hover', (e) => {
            const item = (e as CustomEvent).detail.item as InventoryItem | null
            if (item) { this.tip.item = item; this.tip.hidden = false }
            else      { this.tip.hidden = true }
        })
        this.grid.addEventListener('item-click', (e) => {
            this.scene.features.emit('inventory:use', (e as CustomEvent).detail)
        })

        this.scene.features.on('inventory:changed', this.refresh, this)
    }

    onDestroy() {
        this.scene.features.off('inventory:changed', this.refresh, this)
    }

    private refresh = (items: InventoryItem[]) => {
        this.grid.items = items
    }
}
```

### Pattern: hotbar bound to a service

```ts
// ui/HotbarFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { Hotbar, InventoryItem } from '@toolcase/game-components'

export class HotbarFeature extends HTMLFeature {

    private bar!: Hotbar

    onCreate() {
        this.node.innerHTML = `
            <gc-anchor>
                <gc-hotbar slot="bottom" id="bar" slot-size="64"></gc-hotbar>
            </gc-anchor>
        `
        this.bar = this.node.querySelector<Hotbar>('#bar')!
        this.bar.addEventListener('select', (e) => {
            const { item, index } = (e as CustomEvent).detail as { item: InventoryItem | null; index: number }
            this.scene.features.emit('hotbar:use', { item, index })
        })
        this.scene.features.on('hotbar:slots', this.setSlots, this)
    }

    onDestroy() {
        this.scene.features.off('hotbar:slots', this.setSlots, this)
    }

    private setSlots = (slots: { item: InventoryItem | null; hotkey?: string }[]) => {
        this.bar.slots = slots
    }
}
```

### Pattern: full-screen game-over

```ts
// ui/GameOverFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'

export class GameOverFeature extends HTMLFeature {

    onCreate() {
        const { score = 0, time = '00:00', kills = 0 } = (this.scene.payload ?? {}) as Record<string, any>
        this.node.innerHTML = `
            <gc-game-over-screen id="screen">
                <gc-stat-row label="Score" value="${score}"></gc-stat-row>
                <gc-stat-row label="Time"  value="${time}"></gc-stat-row>
                <gc-stat-row label="Kills" value="${kills}"></gc-stat-row>
            </gc-game-over-screen>
        `
        this.node.querySelector('#screen')!.addEventListener('continue', () => {
            this.scene.goTo('main')
        })
    }
}
```

### Pattern: settings panel

```ts
// ui/SettingsFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'

export class SettingsFeature extends HTMLFeature {

    onCreate() {
        this.node.innerHTML = `
            <gc-panel header="Settings">
                <gc-tab-bar id="tabs">
                    <gc-stack data-tab="graphics" direction="vertical" gap="6px">
                        <gc-graphics-preset-picker preset="high"></gc-graphics-preset-picker>
                        <gc-fps-cap-select value="60"></gc-fps-cap-select>
                        <gc-fov-slider value="90" min="60" max="120"></gc-fov-slider>
                        <gc-vsync-toggle checked></gc-vsync-toggle>
                    </gc-stack>
                    <gc-stack data-tab="audio" direction="vertical" gap="6px">
                        <gc-volume-slider label="Master" value="80"></gc-volume-slider>
                        <gc-volume-slider label="SFX"    value="100"></gc-volume-slider>
                        <gc-volume-slider label="Music"  value="60"></gc-volume-slider>
                    </gc-stack>
                    <gc-stack data-tab="controls" direction="vertical" gap="6px">
                        <gc-mouse-sensitivity value="40"></gc-mouse-sensitivity>
                        <gc-invert-axis-toggle></gc-invert-axis-toggle>
                        <gc-controls-rebind-list></gc-controls-rebind-list>
                    </gc-stack>
                </gc-tab-bar>
                <gc-reset-to-defaults></gc-reset-to-defaults>
            </gc-panel>
        `
        this.node.addEventListener('change', (e) => {
            const target = e.target as HTMLElement
            const detail = (e as CustomEvent).detail
            this.scene.features.emit('settings:change', { tag: target.tagName.toLowerCase(), detail })
        })
    }
}
```

### Pattern: minimap fed by gameplay

```ts
// ui/MinimapFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { Minimap } from '@toolcase/game-components'

export class MinimapFeature extends HTMLFeature {

    private map!: Minimap

    onCreate() {
        this.node.innerHTML = `
            <gc-anchor>
                <gc-minimap slot="top-right" id="map" zoom="1"></gc-minimap>
            </gc-anchor>
        `
        this.map = this.node.querySelector<Minimap>('#map')!
        this.scene.features.on('player:moved',     this.onMove,     this)
        this.scene.features.on('objective:added',  this.onObjective, this)
    }

    onDestroy() {
        this.scene.features.off('player:moved',    this.onMove,     this)
        this.scene.features.off('objective:added', this.onObjective, this)
    }

    private onMove = (p: { x: number; y: number }) => {
        this.map.center = p
    }

    private onObjective = (p: { x: number; y: number; label?: string }) => {
        const marker = document.createElement('gc-objective-marker')
        marker.setAttribute('x', String(p.x))
        marker.setAttribute('y', String(p.y))
        if (p.label) marker.setAttribute('label', p.label)
        this.map.appendChild(marker)
    }
}
```

### Theming inside the game

Override `--fg-*` palette tokens (global reskin) or `--gc-*` per-component knobs. Two natural places to scope them in a Phaser project:

```css
/* index.css — global game theme */
:root {
    --fg-leather:   #14202b;   /* sci-fi panel */
    --fg-parch:     #cfe6ff;
    --fg-gold:      #00ffd1;
    --fg-blood:     #ff3366;
    --fg-display:   'Orbitron', sans-serif;
}

/* scope to a single feature overlay (HTMLFeature root carries .feature-{key}) */
.feature-pauseMenu {
    --gc-blur-overlay-amount: 12px;
}
```

The `.feature-{key}` class on `this.node` makes it easy to write per-overlay CSS without inventing wrappers.

---

## Prefab contract — `prefabs/`

A **prefab** is a `GameObject` (or `GameObject2D`) subclass that bundles sprite + physics body + behavior into one reusable unit. One file per prefab. Every visible entity in the game is a prefab — no inline `scene.add.sprite(...)` for anything that lives longer than a frame.

### Plain prefab — extending `GameObject`

```ts
import { GameObject } from '@toolcase/phaser-plus'

export class Player extends GameObject {

    static readonly KEY = 'player'

    private sprite!: Phaser.GameObjects.Sprite
    private body!: Phaser.Physics.Arcade.Body

    speed = 220
    hp = 100

    onCreate() {
        this.sprite = this.scene.add.sprite(0, 0, 'characters', 'player_idle_0')
        this.add(this.sprite)

        this.scene.physics.add.existing(this)
        this.body = this.body as Phaser.Physics.Arcade.Body
        this.body.setSize(28, 40).setOffset(-14, -8)
        this.body.setCollideWorldBounds(true)
    }

    onUpdate(_time: number, delta: number) {
        // Optional. Only runs if Player is a direct child of the scene.
        // If parented to a Layer, the Layer drives updates via its own loop.
    }

    moveBy(dx: number, dy: number) {
        this.body.setVelocity(dx * this.speed, dy * this.speed)
    }

    takeDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount)
        if (this.hp === 0) {
            this.scene.features.emit('player:died', { id: this.id })
        }
    }

    onDestroy() {
        this.sprite.destroy()
    }
}
```

### Isometric/projection-aware prefab — extending `GameObject2D`

Use when the scene uses `phaser-plus`'s `Scene2D` / `World` projection layer for isometric or top-down-with-depth games.

```ts
import { GameObject2D } from '@toolcase/phaser-plus'

export class Barrel extends GameObject2D {

    static readonly KEY = 'barrel'

    onCreate() {
        const stand = this.scene.add.sprite(0, 0, 'objects', 'barrel_stand')
        const top = this.scene.add.sprite(0, -40, 'objects', 'barrel_top')
        this.add(stand).add(top)
    }
}
```

`GameObject2D` adds projection-aware positioning via `setTransform(x, y)` / `setTransformX` / `setTransformY`. The owning `World` layer applies the projection matrix automatically — never set `this.x` / `this.y` directly on a `GameObject2D` placed in a `World`.

### Custom shared base — `prefabs/CustomGameObject.ts`

Most games end up wanting a project-local base class that bakes in shared behavior (tags, health, pooling-friendly reset, common physics shape, etc.). Add it once in `prefabs/CustomGameObject.ts` and have every other prefab extend it.

```ts
import { GameObject } from '@toolcase/phaser-plus'

export type Tag = 'player' | 'enemy' | 'pickup' | 'projectile' | 'environment'

export class CustomGameObject extends GameObject {

    private tags = new Set<Tag>()

    hasTag(tag: Tag): boolean {
        return this.tags.has(tag)
    }

    addTag(tag: Tag): this {
        this.tags.add(tag)
        return this
    }

    /** Called when GameObjectPool returns this instance to a fresh slot. */
    reset(x: number, y: number) {
        this.setPosition(x, y)
        this.setActive(true).setVisible(true)
    }

    onRemove() {
        this.setActive(false).setVisible(false)
    }
}
```

Then:

```ts
export class Enemy extends CustomGameObject {
    onCreate() {
        this.addTag('enemy')
        // ...
    }
}
```

### GameObject lifecycle

| Hook                       | When                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `onCreate()`               | Once, when the pool first instantiates it. Build sprite, physics body, child objects.     |
| `onAdd(parent)`            | Each time it's added to a parent (Layer, ObjectLayer, container, scene).                  |
| `onUpdate(time, delta)`    | Each frame — **only if** the GameObject is a direct child of the scene. Layers drive own. |
| `onRemove(parent)`         | Each time it's removed from a parent. Use to disable physics body / hide sprite.          |
| `onDestroy()`              | Final destruction. Free anything not auto-cleaned by Phaser's child destroy.              |

Hard rules:

- **Constructor stays empty.** Use `onCreate()`. The pool may construct your prefab before the scene even calls `create()`.
- **Children added with `this.add(...)`** receive `onAdd()` calls automatically if they're GameObjects.
- **No feature lookups inside prefabs.** Prefabs are passive. Features find prefabs via `scene.pool` / `Layer`, not the other way around.
- **`id` is auto-assigned** by `GameObject` (16-char generated id). Use `gameObject.id` for stable comparisons.

---

## Pooling — `GameObjectPool`

Pooled spawning is the **only** approved way to instantiate prefabs in this architecture. Pools recycle instances across spawn/despawn cycles, dramatically cheaper than `new` + GC.

In a Scene's `onCreate`:

```ts
this.pool.add('player', Player)
this.pool.add('enemy', Enemy)
this.pool.add('pickup', Pickup, { initial: 32, max: 256 })
```

Then a feature spawns:

```ts
const enemy = this.scene.pool.spawn<Enemy>('enemy', x, y)
// ...later...
this.scene.pool.release(enemy)
```

Pair with `ObjectLayer` for layer-bound spawning:

```ts
// In Scene.onCreate:
this.features.register('mobs', class MobsLayer extends ObjectLayer {})
// In a feature:
const mobs = this.scene.features.get<ObjectLayer>('mobs')!
const enemy = mobs.add<Enemy>('enemy', 100, 200)   // pool-backed
mobs.remove(enemy)                                  // returns to pool
```

---

## Cross-cutting patterns

### Inter-feature communication

Use the `FeatureRegistry` broadcast bus (`scene.features.emit / on / off`). Avoid `EventEmitter`s of your own for game-side events.

Naming convention: `<domain>:<verb>` — `enemy:killed`, `player:level-up`, `daynight:phase`, `ui:pause-requested`. Keep payload shapes typed via shared `events.ts` files inside `features/`.

### Time, timers, jobs

Use `this.flow` (`FlowEngine`) instead of `setTimeout` / `Phaser.Time.TimerEvent`. `flow` survives pause correctly, integrates with the scene update loop, and exposes `Job` / `Timer` / `Parallel` / `throttle` / `debounce` primitives.

### State machines / behavior trees

For enemy AI, dialog flow, scene state — use `phaser-plus`'s `StateMachine` and `BehaviorTree` from the `flow` and `ai` re-exports. One state machine per Feature; the Feature drives ticks in `onUpdate`.

### Cinema / camera

`phaser-plus/cinema` ships `CameraDirector`, `ScreenShake`, `CameraFlash`, `LetterboxFeature`, `ParallaxLayer`. Register as features in your scene; expose triggers via the bus (`cinema:shake`, `cinema:flash`).

### Input

Register `InputFeature` and bind logical actions (`'jump'`, `'interact'`) to keys/buttons. Features query `input.isDown('jump')` rather than reading raw keycodes. Add `GamepadFeature` / `VirtualJoystick` from the same module if needed.

### Effects (shaders)

Per-GameObject GLSL via `gameObject.effects.add(...)`. **Requires `installEffects(game)` at boot.** 84+ built-in effects available; custom shaders follow the documented pattern in the `phaser-plus` skill.

### Debugging

Add `Debugger` (HTMLFeature wrapping Tweakpane) only in dev builds. Gate behind `if (import.meta.env.DEV)` in scene `onCreate`.

### Services (game-lifetime singletons)

Save data, audio mixer, analytics — anything that must outlive scene transitions — goes in `services/`, accessed through `this.engine.services`:

```ts
// services/SaveService.ts
export class SaveService {
    load(slot: number) { /* ... */ }
    save(slot: number, data: unknown) { /* ... */ }
}

// In a feature:
const save = this.scene.engine.services.get(SaveService)
save.save(0, { score: this.score })
```

---

## Recipes

### Add a new scene

1. Create `src/scenes/<Name>Scene.ts` extending `Scene`. Call `super('<key>')` with the scene key.
2. Override the lifecycle hooks you need (`onLoad` for assets, `onCreate` for setup).
3. Register the class in `boot.ts` `config.scene` array.
4. Navigate to it from another scene with `this.goTo('<key>', payload?)`.

### Add a new feature

1. Create `src/features/<Name>Feature.ts` extending `Feature`.
2. Define exported event constants at the top (`export const X_EVENT = 'x:event'`).
3. Implement `onCreate / onUpdate / onDestroy`.
4. Register in the relevant Scene's `onCreate`: `this.features.register('<key>', <Name>Feature)`.
5. Add subscribers in other features via `this.scene.features.on('<event>', handler, this)`.

### Add a new HTMLFeature (UI overlay)

1. Confirm `dom.createContainer: true` in `boot.ts` config and that `register()` from `@toolcase/game-components` runs at boot.
2. Pick the `gc-*` components that cover the need (consult `game-components/SKILL.md`). Only fall back to raw `<div>` for layout glue not provided by `gc-anchor` / `gc-stack` / `gc-grid`.
3. Create `src/ui/<Name>Feature.ts` extending `HTMLFeature`.
4. Set `this.node.innerHTML` in `onCreate` using `gc-*` markup. Cache typed references via `querySelector<HealthBar>(...)` etc.
5. Set complex props (arrays/objects) as JS properties (`bar.slots = [...]`); set primitives as attributes.
6. Listen to `gc-*` `CustomEvent`s (`select`, `change`, `confirm`, `take`, `item-click`, `item-hover`, `continue`, ...) and re-emit user-intent events on `this.scene.features` (never mutate game state directly).
7. Subscribe to game events in `onCreate`. Unsubscribe in `onDestroy`.
8. Register in Scene's `onCreate`: `this.features.register('<key>', <Name>Feature)`.
9. Theme via `--fg-*` / `--gc-*` overrides scoped on `:root` or `.feature-<key>` in your project stylesheet — do not fork component SCSS.

### Add a new prefab

1. If shared behavior is needed and `prefabs/CustomGameObject.ts` doesn't exist yet, create it.
2. Create `src/prefabs/<Name>.ts` extending `GameObject` (default), `GameObject2D` (isometric), or `CustomGameObject` (project base).
3. Implement `onCreate` to build sprite + physics body + children. Add tags via `addTag(...)` if using `CustomGameObject`.
4. Optionally implement `onAdd / onUpdate / onRemove / onDestroy`.
5. Register with the pool in Scene's `onCreate`: `this.pool.add('<key>', <Name>)`.
6. Spawn from a feature: `this.scene.pool.spawn<<Name>>('<key>', x, y)`.

### Add a service

1. Create `src/services/<Name>Service.ts` as a plain class (no base required).
2. Resolve from any feature via `this.scene.engine.services.get(<Name>Service)`. The first call lazily instantiates.

### Add a Phaser scene transition

1. From the source scene: `this.goTo('<targetKey>', { /* payload */ })`.
2. In the target scene: read via `this.payload`.
3. Both scenes' features go through `preDestroy` → `onDestroy` cleanly — features are recreated on re-entry, never reused.

---

## Anti-patterns

❌ **Using Phaser's raw `Scene.preload/create/update`.** Always override `onLoad / onCreate / onUpdate`. The `phaser-plus` `Scene` reserves the Phaser hooks to drive lifecycle wiring.

❌ **Calling `new Game(config)` more than once.** Single instance, in `boot.ts`, never re-created. Hot-reload should reload the page, not rebuild the game.

❌ **Skipping `installEffects(game)`** then wondering why `gameObject.effects.add(...)` does nothing.

❌ **Forgetting `dom.createContainer: true`** then getting `HTMLFeature` constructor errors at runtime.

❌ **Putting gameplay logic in `Scene.onUpdate`.** Move it to a Feature. The scene's `onUpdate` should usually be empty.

❌ **Manipulating the DOM from a Feature.** That's an HTMLFeature.

❌ **Hand-rolling HUD bars / menus / dialogs / inventory grids when `@toolcase/game-components` already ships them.** Reach for `gc-health-bar`, `gc-pause-menu`, `gc-confirm-dialog`, `gc-inventory-grid`, etc. before authoring `<div class="hp-bar">` markup.

❌ **Forgetting `register()` from `@toolcase/game-components` at boot.** Without it, `gc-*` tags render as inert `HTMLUnknownElement` and the HUD stays blank.

❌ **Importing `@toolcase/game-components/style.css` per-scene or per-HTMLFeature.** Import it once in `boot.ts`. Repeat imports duplicate styles.

❌ **Setting array/object props via attributes** (`<gc-hotbar slots="...">`). Attributes are strings. Use `el.slots = [...]` JS property assignment.

❌ **Forking component SCSS to reskin.** Override `--fg-*` (palette) or `--gc-*` (per-component) custom properties on `:root` or a scoped wrapper.

❌ **Calling `scene.features.get('other')` from a prefab.** Prefabs don't know features. If you need it, drive the prefab from a feature instead.

❌ **`new Player(scene, x, y)` directly.** Always go through the pool: `this.pool.add('player', Player)` then `this.pool.spawn<Player>('player', x, y)`.

❌ **Mutating `gameObject.x` / `.y` on a `GameObject2D` placed in a `World`.** Use `setTransform(x, y)` — direct position mutation breaks projection.

❌ **Long-lived references to other features stored in fields.** Resolve through `scene.features.get` at use site, or subscribe to events. Construction-order assumptions break when registration order changes.

❌ **Global singletons for game state.** Use `services/` (game-lifetime, resolved through `ServiceRegistry`) or features (scene-lifetime).

❌ **Adding setTimeout / setInterval.** Use `this.flow` — pause-aware, scene-scoped, automatically cleaned up.

❌ **Forgetting to `off()` what you `on()`-ed** in feature lifecycle. The bus survives across re-registrations.

❌ **One mega-Feature that does spawning + AI + scoring + UI.** Split it. One concept per feature, communicating via events.

❌ **Mixing scene keys.** Scene keys are unique strings; Feature keys are unique within a scene. Don't reuse strings across the two namespaces.

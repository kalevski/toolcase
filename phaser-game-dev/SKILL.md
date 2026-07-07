---
name: phaser-game-dev
description: Use when scaffolding or extending a Phaser 4 game built on top of `@toolcase/phaser-plus`, with `@toolcase/web-components` as the canonical UI toolkit (HUDs, menus, inventories, dialogs, screens). Defines workspace layout (scenes/ + features/ + ui/ + prefabs/), layering rules (Scene → Feature/HTMLFeature → Prefab GameObject), boot sequence with `installEffects` + `register()` + `style.css`, lifecycle contracts (`onInit/onLoad/onCreate/onUpdate/onDestroy` for scenes, `onCreate/onUpdate/onDestroy` for features, `onCreate/onAdd/onUpdate/onRemove/onDestroy` for game objects), the FeatureRegistry pub-sub bus, GameObjectPool registration/obtain (and ObjectLayer.add for positioned pool-backed spawning), the `dom: { createContainer: true }` HTMLFeature requirement, and the rule that HTMLFeatures compose `tc-*` Web Components instead of hand-rolled markup. Apply when adding a scene, feature, UI overlay, prefab, or scaffolding a new Phaser game workspace.
---

# phaser-game-dev — Architecture Reference

Opinionated blueprint for Phaser 4 games. Layered, registry-driven, ESM. Every scene is a `Scene` subclass; every gameplay system lives in `features/`; every DOM/HUD overlay lives in `ui/`; every visible entity is a prefab in `prefabs/` extending `GameObject` (or `GameObject2D`, or a project-local `CustomGameObject` base). Deviation = bug.

Stack baseline:

- Phaser 4 (`phaser ^4.x`).
- `@toolcase/phaser-plus` ^4.x — **required** runtime layer. Top-level exports: `Engine`, `Scene`, `GameObject`, `Feature`, `FeatureRegistry`, `ServiceRegistry`, `GameObjectPool`, `Layer`, `ObjectLayer`, `HTMLFeature`, `SplitScreen`, `LogLevel`, plus `Events`, `Flow`, `Structs` namespaces. Re-exports from `effects/` (`installEffects`, shader effects), `perspective2d/` (`Scene2D`, `World`, `GameObject2D`, `Grid`), `cinema/` (`CameraDirector`, `ScreenShake`, `CameraFlash`, `DialogCameraCue`, `LetterboxFeature`, `ParallaxLayer`), `input/`, `ai/`, `flow/`, `debugger/`, `audio/` (`AudioFeature`), `persistence/` (`PersistenceFeature`, `SaveService`, `LocalStorageBackend`, `IndexedDBBackend`, `MemoryBackend`), `assets/` (`AssetFeature`), `particles/` (`ParticleFeature`), `net/` (`NetFeature`, `WebSocketTransport`, `LoopbackTransport`), `tilemap/` (`TilemapFeature`).
- `@toolcase/web-components` ^4.x — **required** UI toolkit. Framework-free `tc-*` Web Components for HUDs, menus, inventories, dialogs, settings, screens, minimaps. Every `HTMLFeature` composes these instead of hand-rolling markup.
- `@toolcase/base` ^4.x — peer of `phaser-plus` and `web-components`. Helpers and data structures (`Broadcast`, `ObjectPool`, etc.).
- `@toolcase/logging` ^4.x — peer of `phaser-plus`. Scoped loggers wired through `Engine`.
- TypeScript `strict`, ESM (`"type": "module"`), Node 18+.
- Vite for dev/build (the canonical tooling — Webpack works but is out of scope here).

Required install before anything else:

```bash
npm install phaser @toolcase/phaser-plus @toolcase/web-components @toolcase/base @toolcase/logging
```

If you want shader effects on `GameObject` instances, import and call `installEffects(game)` immediately after `new Game(config)` (see Boot below). This is the recommended pre-registration step — it registers every effect's RenderNode up front. It is not strictly required: `gameObject.effects.add(...)` lazily registers the effect it needs as a fallback (so a forgotten `installEffects` still works), but pre-registering at boot is cleaner and avoids first-use registration cost.

`@toolcase/web-components` requires a one-time `register()` call at boot to define all custom elements globally, plus the bundled stylesheet (`@toolcase/web-components/style.css`). After that, any `HTMLFeature` can author UI with `tc-*` tags directly inside `this.node.innerHTML`.

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
import { register as registerWebComponents } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import { BootScene } from './scenes/BootScene'
import { MainScene } from './scenes/MainScene'
import { GameOverScene } from './scenes/GameOverScene'

registerWebComponents()         // REQUIRED before any HTMLFeature mounts tc-* elements

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
installEffects(game)            // RECOMMENDED if any GameObject uses .effects.add(...) — add() lazy-registers as fallback

export default game
```

Hard rules:

- `dom.createContainer: true` is **mandatory** if any `HTMLFeature` exists. Without it, `HTMLFeature` constructor throws.
- `installEffects(game)` runs **once, after `new Game(config)`**, never inside a scene. It is recommended pre-registration, not strictly required — `gameObject.effects.add(...)` lazy-registers the effect it needs as a fallback if `installEffects` was skipped.
- `register()` from `@toolcase/web-components` runs **once at module top-level**, before `new Game(config)`. It is **idempotent** — the first thing it does is check whether `tc-button` is already defined and return early if so, so an accidental second call is a safe no-op (no `NotSupportedError`). Still call it at boot; registering inside a scene risks racing the first `HTMLFeature.onCreate`.
- The bundled stylesheet `@toolcase/web-components/style.css` must be imported once (boot.ts is the canonical place). Without it, `tc-*` elements render unstyled.
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
        this.pool.register('player', Player)

        this.features.register('dayNight', DayNightCycleFeature)
        this.features.register('hud', HUDFeature)

        const player = this.pool.obtain<Player>('player')!
        player.setPosition(640, 360)
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

> **Emit-before-subscribe drops the event.** `this.emit(event, ...)` checks `scene.features.listenerCount(event)` first: if **no** listener is registered yet, it logs a warning and **drops** the payload (it does not buffer or replay). Consequences for the cross-feature pattern this doc promotes: (1) register the listening feature **before** the emitting one fires — `features.register` order matters, and `onCreate` subscriptions must be wired before the first `emit`; (2) a late-joining feature registered after an event already fired will never see it — re-emit current state on registration (e.g. an `emit('<domain>:state')` snapshot) or have the new feature pull via `scene.features.get(...)`; (3) an unhandled `emit` surfacing as a logger warning usually means a subscriber is missing or the ordering is wrong, not that the payload is malformed.

---

## UI contract — `ui/`

`HTMLFeature` extends `Feature` and gives you a single `<div>` overlay (`this.node`) on top of the canvas. Use it for HUDs, menus, dialog boxes, settings panels, debug consoles. **Requires** `dom.createContainer: true` in the game config.

**UI markup is built from `@toolcase/web-components` `tc-*` Web Components.** Hand-rolled `<div>` markup is reserved for layout glue that `tc-*` doesn't already cover. Compose `tc-anchor`, `tc-stack`, `tc-grid` for layout; `tc-health-bar`, `tc-mana-bar`, `tc-buff-bar`, `tc-hotbar`, `tc-minimap`, `tc-objective-marker`, etc. for HUD pieces; `tc-pause-menu`, `tc-confirm-dialog`, `tc-dialogue-box`, `tc-game-over-screen`, `tc-victory-screen` for menus and screens. See `web-components/SKILL.md` for the full catalog.

```ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { ResourceBar, MenuItem } from '@toolcase/web-components'
import { DAY_NIGHT_TICK, type DayNightPhase } from '../features/DayNightCycleFeature'

export class HUDFeature extends HTMLFeature {

    private hpEl!: ResourceBar
    private mpEl!: ResourceBar
    private scoreEl!: HTMLElement
    private phaseEl!: HTMLElement

    onCreate() {
        this.node.innerHTML = `
            <tc-anchor position="top-left" inset="12px">
                <tc-stack direction="vertical" gap="6px">
                    <tc-health-bar id="hp" value="100" max="100" segments="4" show-text label="HP"></tc-health-bar>
                    <tc-mana-bar   id="mp" value="50"  max="50"  segments="3" show-text label="MP"></tc-mana-bar>
                </tc-stack>
            </tc-anchor>
            <tc-anchor position="top-right" inset="12px">
                <tc-stack direction="horizontal" gap="8px">
                    <tc-eyebrow>SCORE</tc-eyebrow>
                    <tc-title id="score" size="24">0</tc-title>
                    <tc-eyebrow id="phase">day</tc-eyebrow>
                </tc-stack>
            </tc-anchor>
            <tc-anchor position="bottom-right" inset="12px">
                <tc-menu-item id="pauseBtn" label="Pause" hotkey="P"></tc-menu-item>
            </tc-anchor>
        `
        this.hpEl    = this.node.querySelector<ResourceBar>('#hp')!
        this.mpEl    = this.node.querySelector<ResourceBar>('#mp')!
        this.scoreEl = this.node.querySelector('#score')!
        this.phaseEl = this.node.querySelector('#phase')!

        this.node.querySelector<MenuItem>('#pauseBtn')!.addEventListener('tc-select', () => {
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

- `tc-anchor` pins itself to one corner via the `position` attribute (single `<slot>`, no named slots). Use one anchor per corner. `tc-stack` lays out its children inside.
- Resource bars expose `.value` / `.max` as JS properties — set them, no re-render dance.
- `tc-menu-item` emits a `tc-select` `CustomEvent` (click + Enter + Space + hotkey). The HTMLFeature translates that into a game event on the bus.
- `MenuItem` / `ResourceBar` types come from `@toolcase/web-components` — `querySelector<ResourceBar>('tc-health-bar')` is fully typed via `HTMLElementTagNameMap` (`tc-health-bar` / `tc-mana-bar` / `tc-stamina-bar` all map to `ResourceBar`).

Available in addition to `Feature` API:

| Member        | Type             | Purpose                                                                       |
| ------------- | ---------------- | ----------------------------------------------------------------------------- |
| `this.node`   | `HTMLDivElement` | Owned overlay div. Class name is `html-feature feature-{key}`. Set innerHTML. |

`preDestroy()` is already implemented by `HTMLFeature` — it removes the node. If you override it, call `super.preDestroy()`.

Hard rules:

- **One overlay per HTMLFeature.** Need two? Register two HTMLFeatures (`hud`, `pauseMenu`).
- **`tc-*` first, custom markup last.** If `@toolcase/web-components` ships a component for what you need (HUD bars, menus, dialogs, inventory grids, screens, minimap), use it. Project-specific glue goes around it.
- **Set complex props in JS, not attributes.** Arrays/objects (`hotbar.slots = [...]`, `lootPopup.items = [...]`, `partyPanel.members = [...]`) must be assigned via JS properties — attributes only carry strings/numbers/booleans.
- **No game state inside UI.** UI reads via events, writes via events. Never mutate prefabs or other features' fields directly.
- **Theme via `--tc-*` / `--bs-*` CSS custom properties** — set them on `:root`, on the `dom.createContainer` div, or scoped to a feature wrapper. Don't fork component SCSS.
- **Don't reskin tc components with `!important` cascades.** Override the documented CSS variables (`--tc-*`, `--bs-*`) instead.
- **Listeners attached to `this.node` children are auto-cleaned** when the node is removed. Listeners attached elsewhere (e.g. `window.addEventListener`) must be removed in `onDestroy`.

---

## UI building blocks — `@toolcase/web-components`

Canonical mapping from common Phaser-game UI needs to `tc-*` components. Each row below assumes `register()` ran in `boot.ts` and the stylesheet is imported.

| Need                       | Components                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------- |
| HUD layout / corners       | `tc-anchor`, `tc-stack`, `tc-grid`, `tc-safe-area`, `tc-aspect-ratio-box`              |
| Resource bars              | `tc-health-bar`, `tc-mana-bar`, `tc-stamina-bar`, `tc-ammo-counter`, `tc-boss-bar`     |
| Buffs / cooldowns          | `tc-buff-bar`, `tc-buff-icon`, `tc-cooldown-badge`, `tc-circular-progress`             |
| Hotbar / abilities         | `tc-hotbar`, `tc-skill-bar`, `tc-ability-card`, `tc-radial-wheel`                      |
| Inventory                  | `tc-inventory-grid`, `tc-item-slot`, `tc-item-tooltip`, `tc-equipment-doll`            |
| Combat feedback            | `tc-crosshair`, `tc-hit-marker`, `tc-damage-number`, `tc-combo-counter`, `tc-screen-flash` |
| Currency / chips           | `tc-currency-chip`, `tc-currency-display`, `tc-rarity-chip`, `tc-icon-badge`           |
| Menus / pause              | `tc-pause-menu`, `tc-main-menu`, `tc-menu-item`, `tc-tab-bar`, `tc-press-any-key`      |
| Dialogs                    | `tc-confirm-dialog`, `tc-dialogue-box`, `tc-loot-popup`, `tc-report-dialog`            |
| Settings rows              | `tc-toggle-row`, `tc-select-row`, `tc-fov-slider`, `tc-volume-slider`, `tc-fps-cap-select`, `tc-graphics-preset-picker`, `tc-key-binder`, `tc-controls-rebind-list` |
| Map / nav                  | `tc-minimap`, `tc-objective-marker`, `tc-waypoint-marker`, `tc-compass-bar`, `tc-compass-rose` |
| Overlays                   | `tc-vignette-overlay`, `tc-blur-overlay`, `tc-loading-overlay`, `tc-letterbox-bars`, `tc-transition-wipe` |
| Full screens               | `tc-title-screen`, `tc-loading-screen`, `tc-pause-screen`, `tc-game-over-screen`, `tc-victory-screen`, `tc-result-screen`, `tc-stats-screen` |
| Social / multiplayer       | `tc-chat-window`, `tc-kill-feed`, `tc-lobby`, `tc-party-panel`, `tc-invite-toast`      |
| Player / character         | `tc-character-create`, `tc-character-select`, `tc-player-card`, `tc-portrait`, `tc-level-header` |
| Progression / economy      | `tc-quest-tracker`, `tc-journal`, `tc-codex`, `tc-shop-panel`, `tc-crafting-panel`, `tc-battle-pass` |

For the full catalog (attributes, events, types), read `web-components/SKILL.md`.

### Pattern: HUD scaffold

```ts
// ui/HUDFeature.ts — see UI contract example above
```

Layout uses `tc-anchor` for corner pinning and `tc-stack` for inner row/column flow. Bars set their `.value` / `.max` as JS properties. Subscribe to gameplay events; do not poll.

### Pattern: pause menu

```ts
// ui/PauseMenuFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { MenuItem } from '@toolcase/web-components'

export class PauseMenuFeature extends HTMLFeature {

    onCreate() {
        this.node.innerHTML = `
            <tc-blur-overlay>
                <tc-pause-menu>
                    <tc-menu-item label="Resume"   hotkey="R" data-action="resume" selected></tc-menu-item>
                    <tc-menu-item label="Settings" hotkey="S" data-action="settings"></tc-menu-item>
                    <tc-menu-item label="Quit"     hotkey="Q" data-action="quit"></tc-menu-item>
                </tc-pause-menu>
            </tc-blur-overlay>
        `
        this.node.style.display = 'none'
        this.node.querySelectorAll<MenuItem>('tc-menu-item').forEach(item => {
            item.addEventListener('tc-select', () => {
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
        const visible = this.node.style.display !== 'none'
        this.node.style.display = visible ? 'none' : 'block'
        if (visible) this.scene.resume(); else this.scene.pause()
    }
}
```

### Pattern: dialogue with branching choices

```ts
// ui/DialogueFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { DialogueBox, MenuItem } from '@toolcase/web-components'

export interface DialogueLine {
    speaker: string
    text: string
    choices?: { id: string; label: string }[]
}

export class DialogueFeature extends HTMLFeature {

    private box!: DialogueBox

    onCreate() {
        this.node.innerHTML = `
            <tc-anchor position="bottom" inset="24px">
                <tc-stack direction="vertical" gap="8px">
                    <tc-dialogue-box id="line" typing-speed="40"></tc-dialogue-box>
                    <tc-stack id="choices" direction="vertical" gap="4px"></tc-stack>
                </tc-stack>
            </tc-anchor>
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
        this.box.speaker = line.speaker
        this.box.text = line.text
        const choices = this.node.querySelector('#choices')!
        choices.innerHTML = ''
        line.choices?.forEach((c, i) => {
            const item = document.createElement('tc-menu-item') as MenuItem
            item.setAttribute('label', c.label)
            item.setAttribute('hotkey', String(i + 1))
            item.addEventListener('tc-select', () => {
                this.scene.features.emit('dialogue:choice', { id: c.id })
            })
            choices.appendChild(item)
        })
    }

    private close = () => {
        this.node.querySelector('#choices')!.innerHTML = ''
        this.box.text = ''
    }
}
```

### Pattern: inventory + tooltip

```ts
// ui/InventoryFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { InventoryGrid, ItemTooltip, InventoryItem } from '@toolcase/web-components'

export class InventoryFeature extends HTMLFeature {

    private grid!: InventoryGrid
    private tip!: ItemTooltip

    onCreate() {
        this.node.innerHTML = `
            <tc-panel bordered>
                <tc-panel-header>Inventory</tc-panel-header>
                <tc-inventory-grid id="bag" columns="8" slot-size="48"></tc-inventory-grid>
            </tc-panel>
            <tc-item-tooltip id="tip" hidden></tc-item-tooltip>
        `
        this.grid = this.node.querySelector<InventoryGrid>('#bag')!
        this.tip  = this.node.querySelector<ItemTooltip>('#tip')!

        this.grid.addEventListener('tc-select', (e) => {
            const detail = (e as CustomEvent).detail as { item: InventoryItem | null, index: number }
            if (detail.item) {
                this.tip.item = detail.item
                this.tip.hidden = false
            } else {
                this.tip.hidden = true
            }
            this.scene.features.emit('inventory:use', detail)
        })

        this.scene.features.on('inventory:changed', this.refresh, this)
    }

    onDestroy() {
        this.scene.features.off('inventory:changed', this.refresh, this)
    }

    private refresh = (items: (InventoryItem | null)[]) => {
        this.grid.items = items
    }
}
```

### Pattern: hotbar bound to a service

```ts
// ui/HotbarFeature.ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import type { Hotbar, InventoryItem } from '@toolcase/web-components'

export class HotbarFeature extends HTMLFeature {

    private bar!: Hotbar

    onCreate() {
        this.node.innerHTML = `
            <tc-anchor position="bottom" inset="16px">
                <tc-hotbar id="bar" slot-size="64"></tc-hotbar>
            </tc-anchor>
        `
        this.bar = this.node.querySelector<Hotbar>('#bar')!
        this.bar.addEventListener('tc-select', (e) => {
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
        const { score = 0, time = '00:00', kills = 0 } = this.scene.payload as Record<string, any>
        this.node.innerHTML = `
            <tc-game-over-screen id="screen">
                <tc-stat-row label="Score" value="${score}"></tc-stat-row>
                <tc-stat-row label="Time"  value="${time}"></tc-stat-row>
                <tc-stat-row label="Kills" value="${kills}"></tc-stat-row>
            </tc-game-over-screen>
        `
        this.node.querySelector('#screen')!.addEventListener('tc-action', (e) => {
            const { id } = (e as CustomEvent).detail as { id: string }
            if (id === 'continue' || id === 'retry') this.scene.goTo('main')
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
            <tc-panel bordered>
                <tc-panel-header>Settings</tc-panel-header>
                <tc-tab-bar id="tabs">
                    <tc-stack data-tab="graphics" direction="vertical" gap="6px">
                        <tc-graphics-preset-picker value="high"></tc-graphics-preset-picker>
                        <tc-fps-cap-select value="60"></tc-fps-cap-select>
                        <tc-fov-slider value="90" min="60" max="120"></tc-fov-slider>
                        <tc-toggle-row row-label="V-Sync" checked></tc-toggle-row>
                    </tc-stack>
                    <tc-stack data-tab="audio" direction="vertical" gap="6px">
                        <tc-volume-slider row-label="Master" value="80"></tc-volume-slider>
                        <tc-volume-slider row-label="SFX"    value="100"></tc-volume-slider>
                        <tc-volume-slider row-label="Music"  value="60"></tc-volume-slider>
                    </tc-stack>
                    <tc-stack data-tab="controls" direction="vertical" gap="6px">
                        <tc-mouse-sensitivity value="40"></tc-mouse-sensitivity>
                        <tc-toggle-row row-label="Invert Axis"></tc-toggle-row>
                        <tc-controls-rebind-list></tc-controls-rebind-list>
                    </tc-stack>
                </tc-tab-bar>
                <tc-reset-to-defaults></tc-reset-to-defaults>
            </tc-panel>
        `
        this.node.addEventListener('tc-change', (e) => {
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
import type { Minimap } from '@toolcase/web-components'

export class MinimapFeature extends HTMLFeature {

    private map!: Minimap

    private markers: { id: string, x: number, y: number, label?: string }[] = []

    onCreate() {
        this.node.innerHTML = `
            <tc-anchor position="top-right" inset="12px">
                <tc-minimap id="map" world-x="0" world-y="0" world-width="2048" world-height="2048" size="180"></tc-minimap>
            </tc-anchor>
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
        // Re-center by sliding the world window — keeps player roughly central.
        this.map.worldX = p.x - this.map.worldWidth / 2
        this.map.worldY = p.y - this.map.worldHeight / 2
    }

    private onObjective = (p: { id: string; x: number; y: number; label?: string }) => {
        this.markers.push(p)
        this.map.markers = this.markers
    }
}
```

### Theming inside the game

Override `--tc-*` palette tokens (global reskin) or `--bs-<component>-*` per-component knobs. Two natural places to scope them in a Phaser project:

```css
/* index.css — global game theme */
:root {
    --tc-surface:    #14202b;   /* sci-fi panel */
    --tc-text:       #cfe6ff;
    --tc-accent:     #00ffd1;
    --tc-danger:     #ff3366;
    --tc-font-sans:  'Orbitron', sans-serif;
}

/* scope to a single feature overlay (HTMLFeature root carries .feature-{key}) */
.feature-pauseMenu tc-blur-overlay {
    --bs-blur-overlay-blur: 12px;
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

    /** Project-local helper — callers (features / ObjectLayer wrappers) invoke after pool.obtain. */
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

- **Constructor stays empty.** Use `onCreate()`. The pool may construct your prefab before the scene even calls `create()`. If you must declare a constructor, its signature is `(scene, x, y)` and the first statement must be `super(scene, x, y)` — `GameObject`'s ctor wires `scene`/`game`/`id`. Don't put sprite/physics setup there; that still belongs in `onCreate()`.
- **Children added with `this.add(...)`** receive `onAdd()` calls automatically if they're GameObjects.
- **No feature lookups inside prefabs.** Prefabs are passive. Features find prefabs via `scene.pool` / `Layer`, not the other way around.
- **`id` is auto-assigned** by `GameObject` (16-char generated id). Use `gameObject.id` for stable comparisons.

---

## Pooling — `GameObjectPool`

Pooled instantiation is the **only** approved way to materialize prefabs in this architecture. Pools recycle instances across obtain/release cycles, dramatically cheaper than `new` + GC.

Register prefab classes in a Scene's `onCreate`:

```ts
this.pool.register('player', Player)
this.pool.register('enemy', Enemy)
this.pool.register('pickup', Pickup)
// Optional 3rd/4th args: custom instanceFn(key, class, scene) and resetFn(instance).
```

Then a feature obtains an instance (calls `onCreate()` first time, reused thereafter):

```ts
const enemy = this.scene.pool.obtain<Enemy>('enemy')!
enemy.setPosition(x, y)
// ...later...
this.scene.pool.release(enemy)
```

Pair with `ObjectLayer` for layer-bound spawning that wraps obtain + setPosition in one call and returns instances to the pool on remove:

```ts
// In Scene.onCreate:
this.features.register('mobs', class MobsLayer extends ObjectLayer {})
// In a feature:
const mobs = this.scene.features.get<ObjectLayer>('mobs')!
const enemy = mobs.add<Enemy>('enemy', 100, 200)   // pool-backed obtain + position
mobs.remove(enemy)                                  // detach + pool.release
```

---

## Cross-cutting patterns

### Inter-feature communication

Use the `FeatureRegistry` broadcast bus (`scene.features.emit / on / off`). Avoid `EventEmitter`s of your own for game-side events.

Naming convention: `<domain>:<verb>` — `enemy:killed`, `player:level-up`, `daynight:phase`, `ui:pause-requested`. Keep payload shapes typed via shared `events.ts` files inside `features/`.

### Time, timers, jobs

Use `this.flow` (`FlowEngine`) instead of `setTimeout` / `Phaser.Time.TimerEvent`. `flow` survives pause correctly, integrates with the scene update loop, and exposes `Job` / `Timer` / `Parallel` / `throttle` / `debounce` primitives via `flow.jobs`, `flow.timer`, `flow.events`.

> **`flow.physics` is null under Arcade physics.** The collision-event processor (`flow.physics`) is only constructed when `scene.matter` exists — i.e. only under **Matter** physics. The boot config above uses `physics: { default: 'arcade' }`, so `scene.matter` is undefined and `this.flow.physics === null`. Guard before use (`if (this.flow.physics) ...`), or switch the game to Matter (`physics: { default: 'matter' }`) if you need flow-driven collision events. Arcade collision is still available directly via `this.scene.physics.add.collider(...)`.

### State machines / behavior trees

For enemy AI, dialog flow, scene state — use `phaser-plus`'s `StateMachine` and `BehaviorTree`. Both live in the **`flow`** module (`src/flow/`), not `ai`. The `ai` module is pathfinding only (`NavMesh`, `Path`, `PathFinder`) — reach for it when you need movement/navigation, and pair it with a `flow` `BehaviorTree`/`StateMachine` for decision-making. One state machine per Feature; the Feature drives ticks in `onUpdate`.

### Cinema / camera

`phaser-plus/cinema` ships `CameraDirector`, `ScreenShake`, `CameraFlash`, `DialogCameraCue`, `LetterboxFeature`, `ParallaxLayer`. Register as features in your scene; expose triggers via the bus (`cinema:shake`, `cinema:flash`). `DialogCameraCue` dims everything outside a supplied `DialogFrame` rectangle and optionally applies a vignette — call `open(frame, opts?)` / `close()` around dialogue sequences.

### Input

Register `InputFeature` and bind logical actions to keys/buttons via `input.bind('jump', [{ type: 'key', code: 'Space' }])`. Features query `input.isPressed('jump')` (or listen to `ACTION_PRESS`/`ACTION_RELEASE`/`ACTION_HOLD` events) rather than reading raw keycodes. Add `GamepadFeature` / `VirtualJoystick` / `GestureRecognizer` from the same module if needed.

### Effects (shaders)

Per-GameObject GLSL via `gameObject.effects.add(...)`. **`installEffects(game)` at boot is recommended** (pre-registers all effect RenderNodes); `add(...)` lazy-registers the effect it needs as a fallback if you skipped it. 73 built-in effects available; custom shaders follow the documented pattern in the `phaser-plus` skill.

### Debugging

Add `Debugger` (HTMLFeature wrapping Tweakpane) only in dev builds. Gate behind `if (import.meta.env.DEV)` in scene `onCreate`.

### Services (game-lifetime singletons)

Save data, audio mixer, analytics — anything that must outlive scene transitions — goes in `services/`, accessed through `this.scene.services` (an alias of `this.scene.engine.services`):

```ts
// services/SaveService.ts
export class SaveService {
    load(slot: number) { /* ... */ }
    save(slot: number, data: unknown) { /* ... */ }
}

// In a feature:
const save = this.scene.services.resolve(SaveService)
save.save(0, { score: this.score })
```

`resolve(class)` lazy-instantiates on first call. Use `bind(class, factory)` for constructors that need args, or `provide(class, instance)` to inject a prebuilt singleton.

### Audio

`AudioFeature` is a scene-lifetime `Feature` wrapping Phaser's `Sound` manager with named buses (`music`, `sfx`, `ui`, `ambience`), crossfade, per-voice SFX pools, spatial positioning, and ducking. Register it, then drive it entirely through bus events or direct calls (`play`, `playMusic`, `crossfade`, `duck`, `setVolume`). Three bus events are emitted: `AUDIO_MUSIC_START`, `AUDIO_MUSIC_END`, `AUDIO_BUS_CHANGE`.

### Persistence / save data

`PersistenceFeature` wraps a `SaveService` (game-lifetime) with an async slot API (`save`, `load`, `delete`, `list`, `has`) and emits `SAVE_DONE`, `LOAD_DONE`, `SAVE_DELETED` on the feature bus after each operation. Choose a backend at service binding time: `LocalStorageBackend` (synchronous, browser), `IndexedDBBackend` (async, larger payloads), or `MemoryBackend` (ephemeral / testing). Register `SaveService` in `services/` with the desired backend, then register `PersistenceFeature` in the scene that needs save/load.

### Asset loading (runtime bundles)

`AssetFeature` is a `Feature` for declarative, retry-aware asset loading at runtime (after the initial boot preload). Feed it an `AssetManifest` (named bundles of images, atlases, audio, bitmap fonts) and call `loadBundle(name)`. It emits `ASSET_PROGRESS` per-file, `ASSET_LOAD_COMPLETE` on bundle finish, and `ASSET_LOAD_ERROR` on failure. Useful for lazy-loading level art or DLC content mid-session without restarting the scene.

### Particles

`ParticleFeature` is a `Feature` that manages a registry of named `ParticlePreset` configurations wrapping Phaser's particle emitters. Register presets once in `onCreate`, then call `burst(preset, x, y)` for one-shot FX or `stream(preset, x, y)` for a continuous emitter (returns a `StreamHandle` with `stop()`). Events: `PARTICLE_BURST`, `PARTICLE_STREAM_START`, `PARTICLE_STREAM_STOP`. Presets can optionally attach a per-particle GLSL `Effect`.

### Networking

`NetFeature` drives a pluggable `Transport` (WebSocket or the in-process `LoopbackTransport` for local testing) with ping/pong RTT measurement, snapshot + delta entity sync (`syncEntity`, `interpolateEntity`), and optional client-side prediction (`predict`, `getPredicted`). Wire RTT/loss stats to the `NetPanel` debugger via `bindDebugger(dbg)`. Events: `NET_CONNECTED`, `NET_DISCONNECTED`, `NET_RTT_UPDATE`, `NET_ENTITY_STATE`. Swap the wire format by replacing `_sendMessage`/`_onMessage` with a `@toolcase/serializer` codec — the rest of the class is agnostic.

### Tilemaps

`TilemapFeature` is a `Feature` that loads Tiled (`.tmj`) or LDtk (`.ldtk`) maps, adds tilesets, renders layers, wires arcade-physics colliders via `buildColliders`, and generates a `TilemapNavMesh` for A\* pathfinding via `buildNavMesh({ walkable: [...] })`. Convert a Tiled object layer to an `ObjectLayer` with `toObjectLayer(key, layerName, poolKey)`, or read raw objects with `getObjects(layerName)`.

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

1. Confirm `dom.createContainer: true` in `boot.ts` config and that `register()` from `@toolcase/web-components` runs at boot.
2. Pick the `tc-*` components that cover the need (consult `web-components/SKILL.md`). Only fall back to raw `<div>` for layout glue not provided by `tc-anchor` / `tc-stack` / `tc-grid`.
3. Create `src/ui/<Name>Feature.ts` extending `HTMLFeature`.
4. Set `this.node.innerHTML` in `onCreate` using `tc-*` markup. Cache typed references via `querySelector<ResourceBar>('tc-health-bar')` etc.
5. Set complex props (arrays/objects) as JS properties (`bar.slots = [...]`); set primitives as attributes.
6. Listen to `tc-*` `CustomEvent`s (`tc-select`, `tc-change`, `tc-confirm`, `tc-action`, `tc-choice`, `tc-advance`, ...) and re-emit user-intent events on `this.scene.features` (never mutate game state directly).
7. Subscribe to game events in `onCreate`. Unsubscribe in `onDestroy`.
8. Register in Scene's `onCreate`: `this.features.register('<key>', <Name>Feature)`.
9. Theme via `--tc-*` / `--bs-<component>-*` overrides scoped on `:root` or `.feature-<key>` in your project stylesheet — do not fork component SCSS.

### Add a new prefab

1. If shared behavior is needed and `prefabs/CustomGameObject.ts` doesn't exist yet, create it.
2. Create `src/prefabs/<Name>.ts` extending `GameObject` (default), `GameObject2D` (isometric), or `CustomGameObject` (project base).
3. Implement `onCreate` to build sprite + physics body + children. Add tags via `addTag(...)` if using `CustomGameObject`.
4. Optionally implement `onAdd / onUpdate / onRemove / onDestroy`.
5. Register with the pool in Scene's `onCreate`: `this.pool.register('<key>', <Name>)`.
6. Obtain from a feature: `const obj = this.scene.pool.obtain<<Name>>('<key>')!; obj.setPosition(x, y)`. Prefer `ObjectLayer.add('<key>', x, y)` when you also want layer-bound depth sorting + auto-release on remove.

### Add a service

1. Create `src/services/<Name>Service.ts` as a plain class (no base required).
2. Resolve from any feature via `this.scene.services.resolve(<Name>Service)`. The first call lazily instantiates.

### Add a Phaser scene transition

1. From the source scene: `this.goTo('<targetKey>', { /* payload */ })`.
2. In the target scene: read via `this.payload`.
3. Both scenes' features go through `preDestroy` → `onDestroy` cleanly — features are recreated on re-entry, never reused.

---

## Anti-patterns

❌ **Using Phaser's raw `Scene.preload/create/update`.** Always override `onLoad / onCreate / onUpdate`. The `phaser-plus` `Scene` reserves the Phaser hooks to drive lifecycle wiring.

❌ **Calling `new Game(config)` more than once.** Single instance, in `boot.ts`, never re-created. Hot-reload should reload the page, not rebuild the game.

⚠️ **Skipping `installEffects(game)`.** Not fatal — `gameObject.effects.add(...)` lazy-registers the effect it needs as a fallback — but pre-registering at boot is cleaner and avoids first-use registration cost. Prefer calling it.

❌ **Forgetting `dom.createContainer: true`** then getting `HTMLFeature` constructor errors at runtime.

❌ **Putting gameplay logic in `Scene.onUpdate`.** Move it to a Feature. The scene's `onUpdate` should usually be empty.

❌ **Manipulating the DOM from a Feature.** That's an HTMLFeature.

❌ **Hand-rolling HUD bars / menus / dialogs / inventory grids when `@toolcase/web-components` already ships them.** Reach for `tc-health-bar`, `tc-pause-menu`, `tc-confirm-dialog`, `tc-inventory-grid`, etc. before authoring `<div class="hp-bar">` markup.

❌ **Forgetting `register()` from `@toolcase/web-components` at boot.** Without it, `tc-*` tags render as inert `HTMLUnknownElement` and the HUD stays blank.

❌ **Importing `@toolcase/web-components/style.css` per-scene or per-HTMLFeature.** Import it once in `boot.ts`. Repeat imports duplicate styles.

❌ **Setting array/object props via attributes** (`<tc-hotbar slots="...">`). Attributes are strings. Use `el.slots = [...]` JS property assignment.

❌ **Forking component SCSS to reskin.** Override `--tc-*` (palette) or `--bs-<component>-*` (per-component) custom properties on `:root` or a scoped wrapper.

❌ **Calling `scene.features.get('other')` from a prefab.** Prefabs don't know features. If you need it, drive the prefab from a feature instead.

❌ **`new Player(scene, x, y)` directly.** Always go through the pool: `this.pool.register('player', Player)` then `this.pool.obtain<Player>('player')` (or `ObjectLayer.add('player', x, y)`).

❌ **Mutating `gameObject.x` / `.y` on a `GameObject2D` placed in a `World`.** Use `setTransform(x, y)` — direct position mutation breaks projection.

❌ **Long-lived references to other features stored in fields.** Resolve through `scene.features.get` at use site, or subscribe to events. Construction-order assumptions break when registration order changes.

❌ **Global singletons for game state.** Use `services/` (game-lifetime, resolved through `ServiceRegistry`) or features (scene-lifetime).

❌ **Adding setTimeout / setInterval.** Use `this.flow` — pause-aware, scene-scoped, automatically cleaned up.

❌ **Forgetting to `off()` what you `on()`-ed** in feature lifecycle. The bus survives across re-registrations.

❌ **One mega-Feature that does spawning + AI + scoring + UI.** Split it. One concept per feature, communicating via events.

❌ **Mixing scene keys.** Scene keys are unique strings; Feature keys are unique within a scene. Don't reuse strings across the two namespaces.

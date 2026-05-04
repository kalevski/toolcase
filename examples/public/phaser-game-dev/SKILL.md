---
name: phaser-game-dev
description: Use when scaffolding or extending a Phaser 4 game built on top of `@toolcase/phaser-plus`. Defines workspace layout (scenes/ + features/ + ui/ + prefabs/), layering rules (Scene → Feature/HTMLFeature → Prefab GameObject), boot sequence with `installEffects`, lifecycle contracts (`onInit/onLoad/onCreate/onUpdate/onDestroy` for scenes, `onCreate/onUpdate/onDestroy` for features, `onCreate/onAdd/onUpdate/onRemove/onDestroy` for game objects), the FeatureRegistry pub-sub bus, GameObjectPool spawning, and the `dom: { createContainer: true }` HTMLFeature requirement. Apply when adding a scene, feature, UI overlay, prefab, or scaffolding a new Phaser game workspace.
---

# phaser-game-dev — Architecture Reference

Opinionated blueprint for Phaser 4 games. Layered, registry-driven, ESM. Every scene is a `Scene` subclass; every gameplay system lives in `features/`; every DOM/HUD overlay lives in `ui/`; every visible entity is a prefab in `prefabs/` extending `GameObject` (or `GameObject2D`, or a project-local `CustomGameObject` base). Deviation = bug.

Stack baseline:

- Phaser 4 (`phaser ^4.x`).
- `@toolcase/phaser-plus` ^1.x — **required** runtime layer. Provides `Scene`, `Feature`, `HTMLFeature`, `FeatureRegistry`, `GameObject`, `GameObject2D`, `Layer`, `ObjectLayer`, `GameObjectPool`, `FlowEngine`, `Engine`, `ServiceRegistry`, plus `effects/`, `cinema/`, `input/`, `ai/`, `flow/`, `debugger/`, `perspective2d/` re-exports.
- `@toolcase/base` ^2.x — peer of `phaser-plus`. Helpers (`generateId`, `Cache`, `EventEmitter`, etc.) and data structures.
- `@toolcase/logging` ^2.x — peer of `phaser-plus`. Scoped loggers wired through `Engine`.
- TypeScript `strict`, ESM (`"type": "module"`), Node 20+.
- Vite for dev/build (the canonical tooling — Webpack works but is out of scope here).

Required install before anything else:

```bash
npm install phaser @toolcase/phaser-plus @toolcase/base @toolcase/logging
```

If you want shader effects on `GameObject` instances, also import and call `installEffects(game)` immediately after `new Game(config)` (see Boot below). Without it, `gameObject.effects.add(...)` is a no-op.

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
import { BootScene } from './scenes/BootScene'
import { MainScene } from './scenes/MainScene'
import { GameOverScene } from './scenes/GameOverScene'

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

```ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import { DAY_NIGHT_TICK, type DayNightPhase } from '../features/DayNightCycleFeature'

export class HUDFeature extends HTMLFeature {

    private scoreEl!: HTMLElement
    private phaseEl!: HTMLElement

    onCreate() {
        this.node.innerHTML = `
            <div class="hud">
                <div class="hud__score" data-score>0</div>
                <div class="hud__phase" data-phase>day</div>
                <button class="hud__pause" data-pause>pause</button>
            </div>
        `
        this.scoreEl = this.node.querySelector('[data-score]')!
        this.phaseEl = this.node.querySelector('[data-phase]')!

        this.node.querySelector('[data-pause]')!.addEventListener('click', () => {
            this.scene.features.emit('ui:pause-requested')
        })

        this.scene.features.on(DAY_NIGHT_TICK, this.onTick, this)
        this.scene.features.on('score:changed', this.onScore, this)
    }

    onDestroy() {
        this.scene.features.off(DAY_NIGHT_TICK, this.onTick, this)
        this.scene.features.off('score:changed', this.onScore, this)
    }

    private onTick = (payload: { phase: DayNightPhase }) => {
        this.phaseEl.textContent = payload.phase
    }

    private onScore = (payload: { score: number }) => {
        this.scoreEl.textContent = String(payload.score)
    }
}
```

Available in addition to `Feature` API:

| Member        | Type             | Purpose                                                                       |
| ------------- | ---------------- | ----------------------------------------------------------------------------- |
| `this.node`   | `HTMLDivElement` | Owned overlay div. Class name is `html-feature feature-{key}`. Set innerHTML. |

`preDestroy()` is already implemented by `HTMLFeature` — it removes the node. If you override it, call `super.preDestroy()`.

Hard rules:

- **One overlay per HTMLFeature.** Need two? Register two HTMLFeatures (`hud`, `pauseMenu`).
- **No game state inside UI.** UI reads via events, writes via events. Never mutate prefabs or other features' fields directly.
- **CSS lives in a project-level stylesheet** loaded by `index.html`, scoped under `.feature-{key}`. Don't inline all styling.
- **Listeners attached to `this.node` children are auto-cleaned** when the node is removed. Listeners attached elsewhere (e.g. `window.addEventListener`) must be removed in `onDestroy`.

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

1. Confirm `dom.createContainer: true` in `boot.ts` config.
2. Create `src/ui/<Name>Feature.ts` extending `HTMLFeature`.
3. Set `this.node.innerHTML` in `onCreate`. Cache child element references.
4. Subscribe to game events in `onCreate`. Unsubscribe in `onDestroy`.
5. Emit user-intent events on `this.scene.features` (never mutate game state directly).
6. Register in Scene's `onCreate`: `this.features.register('<key>', <Name>Feature)`.
7. Add CSS scoped under `.feature-<key>` in your project stylesheet.

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

❌ **Calling `scene.features.get('other')` from a prefab.** Prefabs don't know features. If you need it, drive the prefab from a feature instead.

❌ **`new Player(scene, x, y)` directly.** Always go through the pool: `this.pool.add('player', Player)` then `this.pool.spawn<Player>('player', x, y)`.

❌ **Mutating `gameObject.x` / `.y` on a `GameObject2D` placed in a `World`.** Use `setTransform(x, y)` — direct position mutation breaks projection.

❌ **Long-lived references to other features stored in fields.** Resolve through `scene.features.get` at use site, or subscribe to events. Construction-order assumptions break when registration order changes.

❌ **Global singletons for game state.** Use `services/` (game-lifetime, resolved through `ServiceRegistry`) or features (scene-lifetime).

❌ **Adding setTimeout / setInterval.** Use `this.flow` — pause-aware, scene-scoped, automatically cleaned up.

❌ **Forgetting to `off()` what you `on()`-ed** in feature lifecycle. The bus survives across re-registrations.

❌ **One mega-Feature that does spawning + AI + scoring + UI.** Split it. One concept per feature, communicating via events.

❌ **Mixing scene keys.** Scene keys are unique strings; Feature keys are unique within a scene. Don't reuse strings across the two namespaces.

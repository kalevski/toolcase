---
name: phaser-plus
description: Use when building Phaser 4 games with @toolcase/phaser-plus — scene lifecycle, feature registry, object pooling, flow events/timers/jobs, layer + camera management, perspective2d (isometric/grid), GLSL shader effects, A* pathfinding (NavMesh), and the Tweakpane in-game debugger.
---

# phaser-plus — API Reference

Unified runtime layer on top of Phaser 4. Adds opinionated scene lifecycle, registries (features, services, pool), event/job flow, layer-per-camera rendering, perspective2d, shader effects, A*, and a debugger feature. Single import surface:

```ts
import {
    Engine, Scene, GameObject, Events,
    Feature, FeatureRegistry, ServiceRegistry,
    Layer, ObjectLayer, HTMLFeature, SplitScreen,
    GameObjectPool,
    Flow,    // { Event, TimeEvent, CollisionEvent, Job, FlowEngine, StateMachine, BehaviorTreeProcessor, ReplayRecorder, Timer, Parallel, throttle, debounce, BT: {...} }
    Structs, // { Matrix2 }
    LogLevel,
    // Debugger
    Debugger, Panel,
    PerformancePanel, MemoryPanel, TimelinePanel, InputPanel, AudioPanel, NetPanel,
    ConsoleCommands, HotReload, RemoteDebugger,
    // Perspective2D
    Scene2D, World, GameObject2D, Grid,
    // Effects
    Effect, EffectManager, installEffects, EFFECT_REGISTRY,
    // AI
    NavMesh, PathFinder, Path, PATH_FOUND, PATH_FAILED,
    // Cinema
    CameraDirector, EASE_LINEAR, EASE_IN_OUT, EASE_OUT, SHOT_DONE,
    ScreenShake, CameraFlash, DialogCameraCue, ParallaxLayer, LetterboxFeature,
    // Input
    InputFeature, ACTION_PRESS, ACTION_RELEASE, ACTION_HOLD,
    InputBuffer, GestureRecognizer,
    GESTURE_TAP, GESTURE_DOUBLE_TAP, GESTURE_LONG_PRESS, GESTURE_SWIPE, GESTURE_PINCH,
    GamepadFeature, GAMEPAD_CONNECTED, GAMEPAD_DISCONNECTED, GAMEPAD_BUTTON_DOWN, GAMEPAD_BUTTON_UP,
    MAPPING_XBOX, MAPPING_PS, MAPPING_SWITCH, MAPPING_STANDARD,
    VirtualJoystick, VIRTUAL_AXIS_X, VIRTUAL_AXIS_Y,
    // Flow extras (also reachable via `Flow.*`)
    STATE_ENTER, STATE_EXIT, STATE_TRANSITION,
    SUCCESS, FAILURE, RUNNING,
    REPLAY_FRAME, REPLAY_END,
    // Audio
    AudioFeature, AUDIO_MUSIC_START, AUDIO_MUSIC_END, AUDIO_BUS_CHANGE,
    // Persistence
    SaveService, PersistenceFeature, SAVE_DONE, LOAD_DONE, SAVE_DELETED,
    LocalStorageBackend, IndexedDBBackend, MemoryBackend
} from '@toolcase/phaser-plus'
```


Peers: `phaser@4.x`, `@toolcase/base@3.x`, `@toolcase/logging@3.x`. Optional peers: `react` / `react-dom` >=18.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Engine & Scene](#engine--scene)
- [GameObject](#gameobject)
- [Features](#features)
  - [Feature](#feature)
  - [FeatureRegistry](#featureregistry)
  - [ServiceRegistry](#serviceregistry)
  - [Layer](#layer)
  - [ObjectLayer](#objectlayer)
  - [HTMLFeature](#htmlfeature)
  - [SplitScreen](#splitscreen)
- [GameObjectPool](#gameobjectpool)
- [Flow](#flow)
  - [FlowEngine](#flowengine)
  - [Event](#event)
  - [TimeEvent](#timeevent)
  - [Job](#job)
  - [CollisionEvent](#collisionevent)
- [Debugger](#debugger)
- [Perspective2D](#perspective2d)
  - [Scene2D](#scene2d)
  - [World](#world)
  - [GameObject2D](#gameobject2d)
  - [Grid](#grid)
  - [Matrix2](#matrix2)
- [Effects](#effects)
- [AI / Pathfinding](#ai--pathfinding)
- [Events constants](#events-constants)
- [Flow extensions — StateMachine, BehaviorTree, Replay](#flow-extensions--statemachine-behaviortree-replay)
  - [StateMachine](#statemachine--finite-state-machine)
  - [BehaviorTree](#behaviortree)
  - [ReplayRecorder](#replayrecorder)
- [Cinema — Camera, Shake, Parallax, Letterbox](#cinema--camera-shake-parallax-letterbox)
  - [CameraDirector](#cameradirector)
  - [ScreenShake](#screenshake)
  - [CameraFlash](#cameraflash)
  - [DialogCameraCue](#dialogcameracue)
  - [ParallaxLayer](#parallaxlayer)
  - [LetterboxFeature](#letterboxfeature)
- [Input — actions, buffer, gamepad, gestures, joystick](#input--actions-buffer-gamepad-gestures-joystick)
  - [InputFeature](#inputfeature--action-mapping)
  - [InputBuffer](#inputbuffer--combo--leniency-window)
  - [GamepadFeature](#gamepadfeature)
  - [GestureRecognizer](#gesturerecognizer)
  - [VirtualJoystick](#virtualjoystick)
- [Audio — bus mixer, music, SFX pool, spatial, ducking](#audio--bus-mixer-music-sfx-pool-spatial-ducking)
- [Worked examples](#worked-examples)
- [Cross-library integration](#cross-library-integration)
- [Theming / styling surfaces](#theming--styling-surfaces)
- [Cheat sheet](#cheat-sheet)

---

## Quick Start

```ts
import { Game, AUTO } from 'phaser'
import { Scene, ObjectLayer, GameObject, installEffects } from '@toolcase/phaser-plus'

class Player extends GameObject {
    onCreate() {
        const sprite = this.scene.add.sprite(0, 0, 'hero')
        this.add(sprite)
    }
}

class GameScene extends Scene {

    onInit() {
        this.pool.register('player', Player)
    }

    onCreate() {
        const layer = this.features.register('main', ObjectLayer)
        layer.add<Player>('player', 100, 100)
    }

    onUpdate(time, delta) { /* per-frame */ }
}

const game = new Game({
    type: AUTO,
    width: 960,
    height: 540,
    dom: { createContainer: true }, // required if Debugger / HTMLFeature is used
    scene: [GameScene]
})

installEffects(game) // registers all built-in shader effects
```

Key contract: subclass `Scene`, override `beforeInit / onInit / onLoad / onCreate / onUpdate / onDestroy`. Don't override Phaser's `init/preload/create/update` — they are taken.

---

## Engine & Scene

### Engine

Per-`Game` singleton wrapping a `LoggerFactory` and a `ServiceRegistry`. Attached to `game.engine` and shared across all Scenes. Created automatically on first Scene init.

| Member | Type | Description |
|---|---|---|
| `services` | `ServiceRegistry` | Game-wide DI container |
| `setLogLevel(level)` | `this` | `level` is a `LogLevel` enum value |
| `getLogger(scope?)` | `Logger` | Scoped logger from `@toolcase/logging` |

(There is a `version` string field on `Engine`, but it is hardcoded and currently stale — do not rely on it to reflect the installed package version.)

### Scene

Base scene with built-in registries. Extends `Phaser.Scene`.

| Member | Type | Description |
|---|---|---|
| `engine` | `Engine` | Per-scene engine handle |
| `services` | `ServiceRegistry` | Same instance as `engine.services` |
| `features` | `FeatureRegistry` | Scene-lifetime features |
| `pool` | `GameObjectPool` | Pooled GameObject factory |
| `flow` | `FlowEngine` | Events/timers/jobs/collisions |
| `payload` | `Record<string, any>` (getter) | Data passed via `goTo(key, data)` |

**Lifecycle hooks** (override in subclass):

| Hook | When |
|---|---|
| `beforeInit()` | First in `init()`, before `onInit` |
| `onInit()` | After registries created |
| `onLoad()` | Phaser `preload` phase |
| `onCreate()` | Phaser `create` phase |
| `onUpdate(time, delta)` | Per frame, after features + GameObjects, before flow |
| `onDestroy()` | Scene shutdown / `goTo` |

**Navigation:**

```ts
this.goTo('NextScene', { score: 42 })
this.restart({ retry: true })
this.pause(); this.resume()
```

---

## GameObject

Phaser `Container` with stable `id`, lifecycle hooks, lazy `EffectManager`, and absolute-position helper.

```ts
class Bullet extends GameObject {
    onCreate() {
        const sprite = this.scene.add.sprite(0, 0, 'bullet')
        this.add(sprite)
    }
    onUpdate(time, delta) {
        this.x += 4
    }
    onDestroy() {}
}
```

| Member | Type |
|---|---|
| `id` | `string` (unique) |
| `effects` | `EffectManager` (lazy getter) |
| `absolute` | `Phaser.Math.Vector2` (cached world position) |
| `getAbsolute(out?)` | Computes world position into `out` |
| `add(child \| children)` | Adds children, calls `onAdd(parent)` if defined |
| `remove(child, destroy?)` | Removes; optional destroy |
| `removeAll(destroy?)` | |
| `onCreate / onAdd / onUpdate / onRemove / onDestroy` | Override hooks |

`onUpdate` only ticks when the GameObject is a direct child of the scene. Nested children must be ticked manually.

---

## Features

### Feature

Base class for scene-lifetime modules. Constructor `(scene, key)` is called by `FeatureRegistry.register`.

| Hook | Purpose |
|---|---|
| `onCreate()` | Setup |
| `onUpdate(time, delta)` | Per-frame |
| `preDestroy()` | Before destroy (allows feature removal during destroy chain) |
| `onDestroy()` | Cleanup |
| `emit(event, ...args)` | Dispatch on the registry's broadcast bus |

### FeatureRegistry

```ts
features.register<T extends Feature>(key: string, FeatureClass): T
features.get<T>(key): T | null
features.has(key): boolean
features.destroy(key): void
features.destroyAll(): void
features.keys: string[]
features.size: number
```

Registry doubles as an event bus (`Broadcast`). Listen with `features.on('layer_depth_update', fn)`.

### ServiceRegistry

Lazy singleton DI, **game-lifetime**.

```ts
services.bind(MyService, () => new MyService(...))   // factory
services.provide(MyService, instance)                // pre-built
services.resolve<T>(MyService): T                    // lazy / cached
services.has(MyService): boolean
services.dispose(MyService): void
services.disposeAll(): void
```

### Layer

`Feature` that owns a dedicated `Phaser.Camera` and a root `GameObject` container. Use one layer per visual plane (background, world, UI).

| Member | Description |
|---|---|
| `container: GameObject` | Root container |
| `camera` (getter) | Owned camera |
| `cameraFilter` (getter) | Bitmask excluding other cameras |
| `list / count` | Children of `container` |
| `visible` (get/set) | Toggles container visibility |
| `depth` (get/set) | Camera + container depth (resorts cameras) |
| `setBackgroundColor(color)` | |
| `centerOn(x, y)` | Camera-centered scrolling |
| `getByName<T>(name)` | Lookup child by `.name` |
| `clear()` | Remove children without destroying |

```ts
const bg = this.features.register('bg', Layer)
bg.setBackgroundColor('#0f172a').depth = 0
```

### ObjectLayer

`Layer` extension that spawns/releases through `scene.pool`.

```ts
const game = this.features.register('game', ObjectLayer)
const enemy = game.add<Enemy>('enemy', x, y)   // pool obtain + position + add
game.remove(enemy)                             // pool release + remove
game.clear()                                   // releases every child to pool
```

### HTMLFeature

`Feature` providing a DOM `<div>` overlaid on the canvas (Phaser DOM container). Requires `dom: { createContainer: true }` in game config.

```ts
class Hud extends HTMLFeature {
    onCreate() {
        this.node.innerHTML = '<div class="hud">…</div>'
    }
}
```

> Note: a `ReactFeature` exists in source (`features/ReactFeature.ts`) for mounting a React tree into the DOM overlay, but it is **not** re-exported from the package root, so `import { ReactFeature } from '@toolcase/phaser-plus'` does not resolve. Until that export gap is closed, mount React manually inside an `HTMLFeature.onCreate()` (`createRoot(this.node).render(...)`).

### SplitScreen

Two-camera follow with adaptive single↔split mode based on point distance.

```ts
const split = this.features.register('split', SplitScreen)
split.setSplitThresholds(400, 320) // enter split / re-merge thresholds
split.follow(playerA.position, playerB.position) // call once with stable refs
split.unfollow()
```

`split.cameras` exposes `{ ui, A, B }`.

---

## GameObjectPool

`scene.pool` — pre-allocated `GameObject` factories.

```ts
this.pool.register<Bullet>('bullet', Bullet,
    /* instanceFn? */ null,        // (key, Cls, scene) => new Bullet(scene)
    /* resetFn? */ (obj) => obj.setActive(false).setVisible(false)
)

const b = this.pool.obtain<Bullet>('bullet')   // calls onCreate() once per instance
this.pool.release(b)                           // resetFn runs each release
this.pool.count('bullet')                      // live instances for one key
this.pool.instances                            // total across all keys
this.pool.dispose()                            // teardown all pools
```

Pooled objects gain a `poolable: true` flag and `release()` closure attached by the underlying `ObjectPool`. Don't manually destroy a pooled GameObject — release it.

---

## Flow

### FlowEngine

Auto-created on each `Scene` (`scene.flow`). Holds four typed processors.

| Processor | Field | Purpose |
|---|---|---|
| `EventProcessor` | `flow.events` | Named one-shot events |
| `TimeEventProcessor` | `flow.timer` | Repeating interval timers |
| `JobProcessor` | `flow.jobs` | Cooperative long-running tasks |
| `CollisionEventProcessor \| null` | `flow.physics` | Matter collisions (only if `scene.matter` exists) |

`flow.active = false` pauses all processors. `flow.addProcessor(eventType, ProcessorClass)` plugs in custom processors.

### Event

Named, optionally delayed, pay-loaded event.

```ts
class DamageEvent extends Flow.Event<{ amount: number }> {
    onFire(payload) {
        player.hp -= payload.amount
    }
}

scene.flow.events.add('damage', DamageEvent)
scene.flow.events.trigger('damage', { amount: 10 }, /* delay s */ 0.5)
scene.flow.events.triggerNow('damage', { amount: 10 })
scene.flow.events.triggerFn(() => console.log('tick'), 1)
scene.flow.events.replace('damage', NewDamageEvent)
scene.flow.events.remove('damage')
scene.flow.events.has('damage')
scene.flow.events.keys
```

### TimeEvent

Recurring timer; `onFire(times)` receives the iteration count.

```ts
class SpawnTick extends Flow.TimeEvent {
    onFire(times) { spawnEnemy() }
}

scene.flow.timer.add('spawn', SpawnTick, /* interval s */ 2, /* delay s */ 0)
scene.flow.timer.remove('spawn')
```

### Job

Cooperative long-running task. `onUpdate(time)` returning `true` signals completion.

```ts
class FadeJob extends Flow.Job<{ target: Phaser.GameObjects.Sprite }> {
    onCreate() { this.t = 0 }
    onUpdate(time) {
        this.t += 0.016
        this.payload.target.alpha = 1 - this.t
        return this.t >= 1   // true → onComplete
    }
    onComplete() {}
    onTerminate(error?) {}
}

scene.flow.jobs.run(FadeJob, { target: sprite })
scene.flow.jobs.maxJobsPerFrame = 4   // raise budget for batch work
scene.flow.jobs.queuedJobs            // pending count
```

Throwing inside `onUpdate` calls `onTerminate(error)` and removes the job.

### CollisionEvent

Matter physics listener. Auto-bound when `scene.matter` is available.

```ts
class HitEvent extends Flow.CollisionEvent {
    onEnter(bodyA, bodyB, event) {}
    onExit(bodyA, bodyB, event) {}
}

// flow.physics is the CollisionEventProcessor (null when scene.matter is absent).
scene.flow.physics?.add('hit', HitEvent)         // register the event class under a name
scene.flow.physics?.setCollision('bullet', 'enemy', 'hit')  // map two Matter body labels → that event
```

Collisions are routed by Matter body `label`. `add(name, EventClass)` registers the handler; `setCollision(labelA, labelB, name)` (symmetric) binds a label pair to it, so `onEnter` / `onExit` fire when bodies with those labels touch.

| Method | Purpose |
|---|---|
| `add(name, EventClass)` | Register a `CollisionEvent` subclass under `name` (calls its `onCreate`) |
| `setCollision(labelA, labelB, name)` | Bind a body-label pair to a registered event (both directions) |
| `removeCollision(labelA, labelB)` | Unbind a label pair |
| `remove(name)` | Tear down a registered event (calls its `onDestroy`) |
| `has(name)` | Whether an event name is registered |

### Flow sugar — `Timer`, `Parallel`, `throttle`, `debounce`

Common scheduling without subclassing `Job`/`TimeEvent`/`Event`.

```ts
import { Flow } from '@toolcase/phaser-plus'

const fire = Flow.Timer.delay(scene, 0.4, () => sword.play('swing'))
fire.cancel()

const tick = Flow.Timer.interval(scene, 1, count => hud.setSeconds(count))
tick.pause(); tick.resume(); tick.cancel()

Flow.Timer.sequence(scene, [
    { delay: 0.0, run: () => intro.show() },
    { delay: 1.5, run: () => intro.hide() },
    { delay: 0.2, run: () => boss.spawn() }
])

const handle = Flow.Parallel.run(2, [
    done => loadAtlas('hero', done),
    done => loadAtlas('mob', done),
    done => loadAtlas('fx', done)
], () => scene.goTo('main'))
handle.remaining // 0..N still pending

const onResize = Flow.throttle(layout, 100)
const onSearch = Flow.debounce(query, 300, { leading: false })
```

Returned handles share `cancel()` / `pause()` / `resume()` (when applicable). `Parallel.run(N, tasks, onAll)` caps concurrency at `N` (use `Infinity`-style `0` to run all at once); each task takes a `done` callback.

---

## Debugger

`HTMLFeature` exposing Tweakpane panels. Requires `dom: { createContainer: true }`.

```ts
import { Debugger, MemoryPanel } from '@toolcase/phaser-plus'

const dbg = this.features.register('debugger', Debugger)
dbg.setExpanded(true)
dbg.inspect(someGameObject)            // routes to built-in GameObject panel
dbg.addPanel('memory', MemoryPanel)    // custom panel
dbg.removePanel('memory')
dbg.getPanel<MemoryPanel>('memory')
```

Built-in panels (always present, cannot be removed): `inspector`, `overview`, `flow`, `layer`, `gameObject`. Extra registered panels available for `addPanel`: `PerformancePanel`, `MemoryPanel`, `TimelinePanel`, `InputPanel`, `AudioPanel`, `NetPanel`.

Built-in tools (also `Panel` subclasses): `ConsoleCommands`, `HotReload`, `RemoteDebugger`.

### Panel (custom)

Subclass to add your own folder.

```ts
class MyPanel extends Panel {
    draw() {
        this.base.addBinding(state, 'fps', { readonly: true, label: 'FPS' })
        this.base.addBlade({ view: 'separator' })
        this.base.addButton({ title: 'Reload' }).on('click', () => location.reload())
    }
    doUpdate() { /* refresh values per tick */ }
    dispose() {}
}

dbg.addPanel('mine', MyPanel, 'My Panel')
```

`this.base` is a Tweakpane folder. The essentials plugin is registered, so blades like `fpsgraph`, `text`, `separator` are available.

---

## Perspective2D

Isometric / projected-2D rendering layer. Use `Scene2D` for an out-of-the-box scene with `world` (World) + `ui` (ObjectLayer) preset, or compose manually.

### Scene2D

```ts
class IsoScene extends Scene2D {
    onCreate() {
        this.world.projection = Structs.Matrix2.createISO(64)
        this.world.register('tile', Tile)
        this.world.add<Tile>('tile', 0, 0)
    }
}
```

Protected fields: `this.world: World`, `this.ui: ObjectLayer`.

### World

`Layer` with projection matrix and depth-sort.

| Member | Description |
|---|---|
| `projection: Matrix2` | World→screen 2×2 transform |
| `register<T>(key, GameObject2DClass)` | Pool-backed registration |
| `add<T>(key, x, y): T \| null` | Spawn at world `(x, y)` |
| `remove<T>(obj)` | Release back to pool |
| `clear()` | Release all |
| `debug(flag?, colors?): this` | Toggle isometric grid overlay |

### GameObject2D

`GameObject` with projection-aware position via `transform`/`pivot`.

```ts
class Tile extends GameObject2D {
    onCreate() { this.add(this.scene.add.image(0, 0, 'tile')) }
}

const t = world.add<Tile>('tile', 4, 2)
t.setTransform(5, 3)   // re-project
```

Use `setTransform / setTransformX / setTransformY` to move in world space — they apply the World's projection automatically.

`addTag / removeTag / removeTags` exist on the base `GameObject2D` as no-op stubs (they just `return this`) — they are override hooks for subclasses, not a working tag system in the base class.

### Grid

Visualization overlay (used internally by `world.debug(true)`):

```ts
const grid = new Grid(this)
grid.setProjection(Structs.Matrix2.createISO(64))
grid.setColors(0x334155, 0x64748b)
```

### Matrix2

2×2 transform matrix (extends `Float32Array`). Constructor and helpers:

```ts
const iso = Structs.Matrix2.createISO(64)
const custom = Structs.Matrix2.create(64, 32, /* angleX deg */ 30, /* angleY deg */ -30)

iso.translate(worldX, worldY, outVec)   // worldX,Y → screen
iso.adjoint                              // for back-projection
iso.inverse                              // cached inverse
iso.determinant
iso.setValues(v00, v01, v10, v11)
```

---

## Effects

GLSL filters attached per-`GameObject` via `obj.effects`. Backed by Phaser 4 `filters.internal`.

### Bootstrap

```ts
import { installEffects } from '@toolcase/phaser-plus'
installEffects(game) // call once after `new Game(config)`
```

### Use

```ts
import { GrayScaleEffect, OutlineEffect, FireEffect } from '@toolcase/phaser-plus'

const fx = obj.effects.add(GrayScaleEffect)
obj.effects.add(OutlineEffect, { thickness: 2, color: 0xff0000 })
obj.effects.add(FireEffect)
obj.effects.list                  // current effects
obj.effects.remove(fx)
obj.effects.clear()
```

### Custom effect

```ts
import { Effect } from '@toolcase/phaser-plus'

class MyEffect extends Effect {
    static KEY = 'my-effect'
    static FRAGMENT = `precision mediump float;
        uniform sampler2D uMainSampler;
        varying vec2 outTexCoord;
        void main() { gl_FragColor = texture2D(uMainSampler, outTexCoord); }`
    intensity = 1
    applyUniforms(programManager, time) {
        programManager.setUniform('uIntensity', this.intensity)
    }
}

// First add() lazy-registers the EffectClass with the renderer; no manual install needed.
obj.effects.add(MyEffect, { intensity: 0.5 })
```

### Built-in shader registry (`EFFECT_REGISTRY`)

Color: `GrayScaleEffect`, `NegativeEffect`, `PosterizeEffect`, `ThresholdEffect`, `ColorRGBEffect`, `ColorEffect`, `HSVEffect`, `ColorChangeEffect`, `SepiaEffect`, `MetalFXEffect`, `GoldFXEffect`, `GoldenFXEffect`, `IcedFXEffect`, `SandFXEffect`, `StoneFXEffect`, `WoodFXEffect`.

Procedural: `NoiseEffect`, `NoiseAnimatedEffect`, `BloodEffect`, `BurningFXEffect`, `FireEffect`, `FireAdditiveEffect`, `SmokeEffect`, `FrozenEffect`, `IceEffect`, `LightningEffect`, `LightningBoltEffect`, `PlasmaRainbowEffect`, `PlasmaShieldEffect`.

Distortion: `BlackHoleEffect`, `TwistEffect`, `DistortionEffect`, `DistortionAdditiveEffect`, `WaveEffect`, `MysticDistortionEffect`, `MysticDistortionAdditiveEffect`, `HeatEffect`, `JellyEffect`, `JellyAutoMoveEffect`, `LiquidEffect`, `LiquifyEffect`, `SlimEffect`.

Dissolve: `DesintegrationFXEffect`, `DestroyedFXEffect`, `CompressionFXEffect`, `PixelEffect`, `Pixel8BitsBlackEffect`, `Pixel8BitsCommodoreEffect`, `Pixel8BitsGameboyEffect`.

Mask: `CircleFadeEffect`, `ClippingEffect`, `EnergyBarEffect`, `GhostEffect`, `FourGradientsEffect`, `AdditiveEffect`, `TeleportationEffect`, `CartoonEffect`.

Lighting: `OutlineEffect`, `PatternEffect`, `PatternAdditiveEffect`, `EdgeColorEffect`, `BlurEffect`, `SharpenEffect`, `GrassFXEffect`, `GrassMultiFXEffect`, `HologramEffect`, `Hologram2Effect`, `Hologram3Effect`, `ShinyReflectEffect`, `SkyCloudEffect`, `WaterAndBackgroundEffect`, `WaterAndBackgroundDeluxeEffect`, `WaterfallEffect`.

---

## AI / Pathfinding

Cooperative A* on a user-defined grid mesh.

### NavMesh (extend)

```ts
class TileMesh extends NavMesh {
    constructor(private map: Phaser.Tilemaps.Tilemap) { super() }
    isBlocked(x, y) { return this.map.getTileAt(x, y)?.collides ?? true }
    cost(x, y) { return this.map.getTileAt(x, y)?.properties.cost ?? 1 }
}
```

### PathFinder (Feature)

```ts
const pathFinder = this.features.register('pathfinder', PathFinder)
pathFinder.setMesh(new TileMesh(map))
pathFinder.budgetMs = 2 // time slice per frame

const path = pathFinder.findPath(sx, sy, ex, ey, /* maxIterations */ 5000)

path.on(PATH_FOUND, (waypoints: Waypoint[]) => {
    // [{ x, y }, ...] in grid coords
})
path.on(PATH_FAILED, (reason: string) => {
    // 'end_blocked' | 'exhausted' | 'max_iterations'
})
```

Each `findPath` mints a fresh `Path` backed by an `@toolcase/base` `AStar` stepped cooperatively — `budgetMs` caps the per-frame slice. Heuristic is octile (8-connectivity, diagonal squeeze through two blocked orthogonals is rejected).

---

## Events constants

`Events` namespace re-exports string constants used internally on the `FeatureRegistry` bus and elsewhere. Most-used:

| Constant | Emitted on | Args |
|---|---|---|
| `LAYER_DEPTH_UPDATE` | `features` (registry) | — |

```ts
import { Events } from '@toolcase/phaser-plus'
this.features.on(Events.LAYER_DEPTH_UPDATE, () => {/* ... */})
```

---

## Flow extensions — StateMachine, BehaviorTree, Replay

`Flow.StateMachine`, `Flow.BT.*`, and `Flow.ReplayRecorder` are scene-lifetime `Feature`s. Register through `scene.features.register(...)`.

### StateMachine — finite state machine

Generic context `C`, fluent definition.

```ts
import { Flow } from '@toolcase/phaser-plus'

interface AICtx { hp: number, target: any | null }

class EnemyAI extends Flow.StateMachine<AICtx> {
    onCreate() {
        this
            .setContext({ hp: 100, target: null })
            .addState('idle',   { onUpdate: ctx => ctx.target && this.fire('see_target') })
            .addState('chase',  { onEnter: () => sprite.play('run') })
            .addState('attack', { onEnter: swing, onExit: clearWindup })
            .addState('flee',   { onEnter: () => sprite.play('panic') })
            .addTransition('idle', 'chase', 'see_target')
            .addTransition('chase', 'attack', null, c => distance(c) < 1)
            .addTransition(null, 'flee', null, c => c.hp < 20)
            .setStart('idle')
        super.onCreate()
    }
}

const ai = scene.features.register('enemy.ai', EnemyAI)
ai.fire('see_target')      // signal-driven transition
ai.go('flee')              // forced jump
ai.is('attack')            // current-state predicate
ai.current                 // 'idle' | 'chase' | ...
```

`from === null` is a global transition (any source). Listen for transitions:

```ts
import { STATE_ENTER, STATE_EXIT, STATE_TRANSITION } from '@toolcase/phaser-plus'
ai.on(STATE_TRANSITION, (from, to) => log.info('fsm', { from, to }))
```

### BehaviorTree

Composed of `BT.Sequence`, `BT.Selector`, `BT.Parallel`, `BT.Action`, `BT.Condition`, `BT.Inverter`, `BT.Repeater`, `BT.AlwaysSucceed`, `BT.AlwaysFail`. Run via `Flow.BehaviorTreeProcessor`.

```ts
import { Flow } from '@toolcase/phaser-plus'
const { Sequence, Selector, Action, Condition } = Flow.BT

const tree = new Selector([
    new Sequence([
        new Condition(ctx => ctx.blackboard.lowHP === true),
        new Action(ctx => { drinkPotion(ctx); return 'success' })
    ]),
    new Sequence([
        new Condition(ctx => ctx.blackboard.target !== null),
        new Action(ctx => attack(ctx))   // returns 'running' until hit lands
    ]),
    new Action(_ctx => { wander(); return 'success' })
])

const proc = scene.flow.addProcessor(Flow.BehaviorTreeProcessor.EVENT_TYPE, Flow.BehaviorTreeProcessor)
proc.add('boss', tree, { lowHP: false, target: null }, /* tickIntervalSec */ 0.1)

// blackboard is mutable
proc.get('boss')!.blackboard.target = player
```

Status values: `'success' | 'failure' | 'running'`. `running` keeps the cursor in `Sequence`/`Selector`.

### ReplayRecorder

Deterministic input capture/playback (assumes deterministic sim). The recorder ticks a fixed-rate frame accumulator on `onUpdate`; per frame it snapshots the inputs staged via `setInput(key, value)` and emits `REPLAY_FRAME`. Inputs reset each frame.

```ts
import { Flow, REPLAY_FRAME, REPLAY_END } from '@toolcase/phaser-plus'

const replay = scene.features.register('replay', Flow.ReplayRecorder)
const session = replay.record(42, 60)         // (seed, fps) → ReplaySession { seed, fps, frames[] }

// Stage inputs for the current frame; they are captured on the next tick.
scene.flow.events.add('input', class extends Flow.Event<{ action: string }> {
    onFire(payload) { replay.setInput('action', payload.action) }
})

const recorded = replay.stop()                // returns the ReplaySession (or null)

// Play it back — REPLAY_FRAME is emitted with (tick, inputs) positional args.
replay.play(recorded!)
replay.on(REPLAY_FRAME, (tick, inputs) => apply(inputs))
replay.on(REPLAY_END, session => log.info('replay finished', session))
```

During playback read the active frame's inputs with `replay.readInput(key)`. `replay.state` is `'idle' | 'recording' | 'playing'`; `replay.tick` is the current frame index.

---

## Cinema — Camera, Shake, Parallax, Letterbox

### CameraDirector

Queues "shots" — follow / pan / zoom / fit-bounds / spline. One shot active at a time; `SHOT_DONE` fires per shot.

```ts
import { CameraDirector, EASE_IN_OUT, SHOT_DONE } from '@toolcase/phaser-plus'

const director = scene.features.register('camera', CameraDirector)
director.setCamera(scene.cameras.main)

director.queue({ type: 'follow', target: player, lerp: 0.1 })
director.queue({ type: 'zoom', zoom: 2, duration: 0.6, ease: EASE_IN_OUT })
director.queue({
    type: 'fit-bounds',
    x: 0, y: 0, width: 1024, height: 768,
    duration: 0.8, padding: 32
})
director.queue({
    type: 'spline',
    points: [{ x: 0, y: 0 }, { x: 200, y: 100 }, { x: 400, y: 0 }],
    duration: 4, loop: true
})

director.on(SHOT_DONE, shot => log.debug('shot done', shot.type))
director.skip()       // drop current shot, advance queue
director.clear()      // stop & flush
```

Easing constants exported: `EASE_LINEAR`, `EASE_IN_OUT`, `EASE_OUT`. Custom easing is any `(t: number) => number`.

### ScreenShake

Trauma-based. Multiple sources stack; each decays at its own rate. Sources can be random-noise (default) or deterministic sine.

```ts
import { ScreenShake } from '@toolcase/phaser-plus'

const shake = scene.features.register('shake', ScreenShake)
shake.setMaxOffset(20).setMaxAngle(0.04).setExponent(2)

shake.add(0.6, 1.5)              // raw trauma + decay-per-second
shake.impact(0.8)                // sharp pulse: trauma=0.8, decay=4
shake.rumble(0.35, 2)            // sustained low: intensity, durationSec
shake.sine(0.5, 12, 0.5)         // deterministic: amplitude, freqHz, durationSec
shake.clear()
```

| Method | Mode | Use for |
|---|---|---|
| `add(trauma, decay)` | random | generic falloff |
| `impact(trauma = 0.8)` | random | hit-stop, weapon impact |
| `rumble(intensity, durationSec = 1)` | random | engines, sustained tension |
| `sine(intensity, freqHz = 12, durationSec = 1)` | sine | predictable wobbles, vehicle idle |

`trauma` / `intensity` is `[0..1]`; the visual effect is `trauma^exponent`. Random and sine sources can be active simultaneously and overlay.

### CameraFlash

Fullscreen color overlay with hold + fade. Multiple flashes blend (weighted RGB, summed alpha clamped to 1).

```ts
import { CameraFlash } from '@toolcase/phaser-plus'

const flash = scene.features.register('flash', CameraFlash)
flash.flash(0xffffff, /* fade s */ 0.25)                    // white blink
flash.flash(0xff2244, /* fade s */ 0.6, /* hold s */ 0.05)  // red hit
flash.setDepth(1100)
flash.clear()
```

`flash(color, durationSec, holdSec = 0)` queues a flash; the overlay reaches `color` immediately, holds at full alpha for `holdSec`, then fades over `durationSec`.

### DialogCameraCue

Frame-and-dim feature for NPC moments / dialog beats. Four screen-locked dim panels mask everything outside the focus rect, with optional inner vignette and optional camera blur post-FX. Re-`focus(...)` while open to retarget without flicker.

```ts
import { DialogCameraCue } from '@toolcase/phaser-plus'

const cue = scene.features.register('dialog', DialogCameraCue)
cue.setDimColor(0x000000).setDimAlpha(0.6).setDefaultFade(0.3)

cue.focus({ x: 320, y: 180, width: 480, height: 280 }, { vignette: true })
cue.focus({ x: 0, y: 0, width: 1280, height: 200 }, { fadeSec: 0.4, blur: true })
cue.focus(null)        // dim entire viewport (full-screen mask)

cue.clear()            // fade dim out
cue.isOpen()           // boolean
```

`focus(frame, opts?)` — `frame` is screen-space `{ x, y, width, height }` (scrollFactor = 0) or `null` to dim the full viewport. `opts.fadeSec` overrides default fade; `opts.vignette` adds a soft inner ring inside the frame; `opts.blur` toggles `camera.postFX.addBlur` if available.

| Method | Effect |
|---|---|
| `focus(frame, opts?)` | open or retarget the cue |
| `clear()` | fade out & release blur |
| `setDimColor(color)` / `setDimAlpha(0..1)` | tune the mask |
| `setDepth(depth)` | render layer (default `1090`, vignette renders at `depth+1`) |
| `setDefaultFade(sec)` | default in/out duration |

### ParallaxLayer

A `Layer` whose camera scrolls at a factor of the reference camera. Optional auto-tiling for infinite backgrounds.

```ts
import { ParallaxLayer } from '@toolcase/phaser-plus'

const sky = scene.features.register('sky', ParallaxLayer)
sky.setFactor(0.2).setReference(scene.cameras.main)
sky.depth = -10
sky.container.add(scene.add.image(0, 0, 'sky'))

const trees = scene.features.register('trees', ParallaxLayer)
trees.setFactor(0.6).setAutoTile(512, 512)
trees.addTiled(scene.add.image(0, 0, 'tree-band'))
```

### LetterboxFeature

Aspect-ratio mask that draws bars whenever the viewport doesn't match the target aspect. Re-layouts automatically on `scale.resize`.

```ts
import { LetterboxFeature } from '@toolcase/phaser-plus'

const letterbox = scene.features.register('letterbox', LetterboxFeature)
letterbox.setAspect(21 / 9)         // cinematic — adds top/bottom bars on 16:9 viewports
letterbox.setBarColor(0x000000)
letterbox.setBarDepth(1000)
```

`setAspect(ratio)` is the toggle: passing a value matching the viewport hides the bars. `setBarColor(0xRRGGBB)` retints, `setBarDepth(depth)` re-layers.

---

## Input — actions, buffer, gamepad, gestures, joystick

### InputFeature — action mapping

Bind each game action to one or more sources (key / mouse / gamepad button / axis / virtual). Emits `ACTION_PRESS` / `ACTION_RELEASE` / `ACTION_HOLD`.

```ts
import { InputFeature, ACTION_PRESS, ACTION_RELEASE } from '@toolcase/phaser-plus'

const input = scene.features.register('input', InputFeature)
input.bind('jump',   [{ type: 'key', code: 'SPACE' }, { type: 'gamepad', button: 0 }])
input.bind('shoot',  [{ type: 'mouse', button: 0 }, { type: 'gamepad', button: 7 }])
input.bind('move-x', [{ type: 'axis', axis: 0, threshold: 0.2 }])

input.on(ACTION_PRESS, (action: string) => {
    if (action === 'jump') player.jump()
})
input.on(ACTION_RELEASE, action => stopAction(action))
input.isPressed('shoot')      // bool query
input.holdMs('shoot')         // how long held in ms
```

### InputBuffer — combo / leniency window

Records last N actions inside a sliding window. Use to forgive 100ms-late jumps or detect combos.

```ts
import { InputBuffer } from '@toolcase/phaser-plus'

const buffer = scene.features.register('input.buffer', InputBuffer)
buffer.setCapacity(32).setWindow(150)

input.on(ACTION_PRESS, action => buffer.push(action))

function tryDoubleJump(now: number) {
    if (player.airborne && buffer.consume('jump', 250, now)) {
        player.doubleJump()
    }
}
```

`consume()` removes the matching entry; `peek()` keeps it. `windowMs` defaults from `setWindow`.

### GamepadFeature

Higher-level gamepad polling — rumble, deadzones, multi-pad routing, per-pad mapping presets (`MAPPING_XBOX` / `MAPPING_PS` / `MAPPING_SWITCH` / `MAPPING_STANDARD`).

```ts
import { GamepadFeature, MAPPING_PS } from '@toolcase/phaser-plus'

const gamepad = scene.features.register('gamepad', GamepadFeature)
gamepad.setDefaultDeadZone(0.15)
gamepad.setDefaultMapping('xbox')
gamepad.setMapping(0, MAPPING_PS)

if (gamepad.isConnected(0)) {
    const { x, y, rx, ry } = gamepad.axes(0)
    gamepad.rumble(0, /* strong */ 0.6, /* weak */ 0.2, /* ms */ 200)
}
```

Emits `GAMEPAD_CONNECTED` / `GAMEPAD_DISCONNECTED` / `GAMEPAD_BUTTON_DOWN` / `GAMEPAD_BUTTON_UP` on the feature bus.

### GestureRecognizer

Tap / double-tap / long-press / swipe / pinch from touch input. Event names are exported constants — use them, not raw strings.

```ts
import {
    GestureRecognizer,
    GESTURE_TAP, GESTURE_DOUBLE_TAP, GESTURE_LONG_PRESS,
    GESTURE_SWIPE, GESTURE_PINCH
} from '@toolcase/phaser-plus'

const gestures = scene.features.register('gestures', GestureRecognizer)
gestures.on(GESTURE_SWIPE, ({ direction, length }) => {
    if (direction === 'left' && length > 80) player.dash(-1)
})
gestures.on(GESTURE_DOUBLE_TAP, ({ x, y }) => placeMarker(x, y))
gestures.on(GESTURE_PINCH, ({ scale }) => camera.setZoom(camera.zoom * scale))
```

### VirtualJoystick

On-screen analog stick + buttons (mobile/touch). Wire to an `InputFeature` to drive virtual bindings; the joystick also feeds `VIRTUAL_AXIS_X` / `VIRTUAL_AXIS_Y`.

```ts
import { VirtualJoystick, InputFeature, VIRTUAL_AXIS_X, VIRTUAL_AXIS_Y } from '@toolcase/phaser-plus'

const input = scene.features.register('input', InputFeature)
const stick = scene.features.register('stick', VirtualJoystick)

stick.setInput(input)
stick.setJoystickConfig({ size: 160, placement: 'left', bottomOffset: 48, sideOffset: 48, deadZone: 0.2 })
stick.addButton({ id: 'jump', label: 'A', placement: 'right' })

scene.events.on('update', () => {
    const { x, y } = stick.vector
    player.x += x * speed
    player.y += y * speed
})
```

Buttons set virtual booleans (`input.setVirtual(id, …)`); pair with an `{ type: 'virtual', id }` binding on `InputFeature.bind('jump', [...])`.

---

## Worked examples

### Side-scroller mini scene (Layer + Pool + Flow + Effects)

```ts
import { Scene, Layer, ObjectLayer, GameObject, Flow, OutlineEffect } from '@toolcase/phaser-plus'

class Bullet extends GameObject {
    onCreate() { this.add(this.scene.add.sprite(0, 0, 'bullet')) }
    onUpdate() { this.x += 10; if (this.x > 1000) (this as any).release() }
}

class Hero extends GameObject {
    onCreate() {
        this.add(this.scene.add.sprite(0, 0, 'hero'))
        this.effects.add(OutlineEffect, { thickness: 2, color: 0xffeb3b })
    }
    onUpdate(_t: number, delta: number) {
        if (cursors.left.isDown)  this.x -= delta * 0.4
        if (cursors.right.isDown) this.x += delta * 0.4
    }
}

class StageScene extends Scene {

    onInit() {
        this.pool.register('bullet', Bullet)
        this.pool.register('hero', Hero)
    }

    onLoad() {
        this.load.image('hero', 'hero.png')
        this.load.image('bullet', 'bullet.png')
    }

    onCreate() {
        const bg = this.features.register('bg', Layer)
        bg.setBackgroundColor('#0f172a').depth = 0

        const game = this.features.register('game', ObjectLayer)
        game.depth = 10
        game.add<Hero>('hero', 100, 300)

        // Spawn bullet every 250ms
        const scene = this
        this.flow.timer.add('shoot', class extends Flow.TimeEvent {
            onFire() {
                const b = scene.pool.obtain<Bullet>('bullet')
                b.setPosition(120, 300)
                game.container.add(b)
            }
        }, 0.25)

        // Delayed boss intro
        this.flow.events.add('boss', class extends Flow.Event<{ name: string }> {
            onFire(payload) { spawnBoss(payload.name) }
        })
        this.flow.events.trigger('boss', { name: 'Wyrm' }, 5)
    }
}
```

### Isometric world with pathfinding

```ts
import { Scene2D, Structs, NavMesh, PathFinder, PATH_FOUND, GameObject2D } from '@toolcase/phaser-plus'

class Tile extends GameObject2D {
    onCreate() { this.add(this.scene.add.image(0, 0, 'iso-tile')) }
}

class GridMesh extends NavMesh {
    constructor(private blocked: Set<string>) { super() }
    isBlocked(x: number, y: number) { return this.blocked.has(`${x},${y}`) }
    cost(_x: number, _y: number) { return 1 }
}

class IsoScene extends Scene2D {
    onCreate() {
        this.world.projection = Structs.Matrix2.createISO(64)
        this.world.register('tile', Tile)
        for (let x = 0; x < 16; x++)
            for (let y = 0; y < 16; y++) this.world.add<Tile>('tile', x, y)

        const mesh = new GridMesh(new Set(['3,3', '3,4', '4,3']))
        const pf = this.features.register('pf', PathFinder)
        pf.setMesh(mesh)
        pf.budgetMs = 2

        const path = pf.findPath(0, 0, 10, 10)
        path.on(PATH_FOUND, points => moveAlong(points))
    }
}
```

### Multiplayer scene with debugger + remote logger

```ts
import { Scene, Debugger, MemoryPanel, NetPanel, LogLevel } from '@toolcase/phaser-plus'

class ArenaScene extends Scene {
    onInit() {
        this.engine.setLogLevel(LogLevel.DEBUG)
    }
    onCreate() {
        const dbg = this.features.register('debug', Debugger)
        dbg.addPanel('memory', MemoryPanel)
        dbg.addPanel('net', NetPanel)
        dbg.setExpanded(true)
    }
}
```

### AI mob with StateMachine + flow events

```ts
class GoblinAI extends Flow.StateMachine<{ player: any, hp: number }> {
    onCreate() {
        this
            .setContext({ player: scene.player, hp: 60 })
            .addState('patrol', { onUpdate: patrol })
            .addState('alert',  { onEnter: alert })
            .addState('combat', { onUpdate: combat })
            .addTransition('patrol', 'alert', 'sees-player')
            .addTransition('alert',  'combat', null, ctx => distance(ctx) < 4)
            .addTransition(null, 'patrol', null, ctx => ctx.player === null)
            .setStart('patrol')
        super.onCreate()
    }
}

scene.features.register('goblin.ai', GoblinAI)
scene.flow.events.add('sees-player', class extends Flow.Event {
    onFire() { (scene.features.get('goblin.ai') as GoblinAI).fire('sees-player') }
})
```

---

## Cross-library integration

### `@toolcase/serializer` for netcode

```ts
import Serializer from '@toolcase/serializer'

const wire = new Serializer('arena.v1')
wire.define('Snapshot', [
    { key: 'tick', type: 'uint32', rule: 'required' },
    { key: 'pos',  type: 'bytes',  rule: 'required' }
])

class NetFeature extends Feature {

    onCreate() {
        this.scene.flow.events.add('tx', class extends Flow.Event<{ tick: number, pos: Uint8Array }> {
            onFire(p) { ws.send(wire.encode('Snapshot', p)) }
        })
    }

}
```

### `@toolcase/web-components` HUD overlay

`HTMLFeature` hosts the HUD; bind values per-frame.

```ts
import { HTMLFeature } from '@toolcase/phaser-plus'
import { register } from '@toolcase/web-components'
register()

class Hud extends HTMLFeature {
    onCreate() {
        this.node.innerHTML = '<tc-health-bar id="hp" value="100" max="100"></tc-health-bar>'
    }
    onUpdate() {
        ;(this.node.querySelector('#hp') as any).value = this.scene.player.hp
    }
}
```

### `@toolcase/base` pool & state

```ts
import { State } from '@toolcase/base'

interface World { score: number, wave: number }
const world = new State<World>({ score: 0, wave: 1 })

scene.engine.services.provide(State as any, world)
world.on('state.score', s => log.info('score', s))
```

---

## Theming / styling surfaces

`phaser-plus` is a runtime layer; most "look" lives inside Phaser GameObjects (textures, tints, alpha, pipelines). A few surfaces are HTML/CSS-themable:

| Surface | How to style |
|---|---|
| Phaser GameObjects | Use Phaser's native API: `setTint(0xRRGGBB)`, `setAlpha`, `setBlendMode`, custom shaders via `Effect`. |
| `Effect` shaders | The 73 built-in effects accept numeric `color` parameters in `0xRRGGBB` form — pass game-themed palette values (e.g. from `@toolcase/base` `Color`, where keys resolve as `Color.RED` / `Color.BLUE` etc., or `Color.toNumber('blue')` for the `0xRRGGBB` number) to keep visuals consistent across scenes. |
| `Cinema` overlays | `CameraFlash.flash(color, ...)`, `LetterboxFeature.setBarColor`, `DialogCameraCue.setDimColor` — all accept `0xRRGGBB`. |
| `HTMLFeature` content | Plain DOM inside `this.node`. Style with regular CSS / SCSS or by mounting `@toolcase/web-components` (`tc-*` web components) — they expose a full `--tc-*` / `--bs-*` variable layer documented in their SKILL.md. |
| `Debugger` panels | Tweakpane folders; restyle with Tweakpane's own CSS variables on the panel container. |

Color discipline tip: the `0xRRGGBB` literals used by `setTint` / shader effects / cinema overlays are easy to scatter. Consolidate them into a constants module (or the `Color` palette from `@toolcase/base` — `Color.toNumber('blue')` yields the `0xRRGGBB` number) and pass references — that way one change retones every scene.

---

---

## Audio — bus mixer, music, SFX pool, spatial, ducking

`AudioFeature` is a scene-lifetime `Feature` that owns a master bus plus four default named buses (`music`, `sfx`, `ui`, `ambience`), each with independent volume / mute / pan. It handles music playback with crossfade, pooled fire-and-forget SFX with polyphony limits, spatial pan+attenuation by world position, and per-bus ducking. It wires directly into `AudioPanel` via `bindDebugger`.

### AudioFeature

```ts
import { AudioFeature, AUDIO_MUSIC_START, AUDIO_MUSIC_END, AUDIO_BUS_CHANGE } from '@toolcase/phaser-plus'

const audio = scene.features.register('audio', AudioFeature)
```

Default buses created automatically: `'music'`, `'sfx'`, `'ui'`, `'ambience'`. Add custom buses with `addBus(name)`.

#### Master

```ts
audio.setMasterVolume(0.8)     // 0–1
audio.setMasterMute(true)
audio.getMasterVolume()        // → number
audio.isMasterMute()           // → boolean
```

#### Per-bus controls

```ts
audio.setVolume('music', 0.6)   // 0–1; multiplied with master
audio.setMute('sfx', true)
audio.setPan('ui', -0.3)        // –1..1

const bus = audio.getBus('music')  // → Readonly<{name,volume,mute,pan}> | null
```

#### Music (one track per bus, with crossfade)

```ts
audio.play('music', 'theme', /* loop */ true)             // immediate start
audio.crossfadeTo('music', 'boss_theme', 1200)            // fade over 1200ms
audio.stopMusic('music', /* fade ms */ 600)               // optional fade-out
```

#### SFX (pooled fire-and-forget, polyphony limit)

Register SFX keys once (pre-allocates `maxVoices` sound instances for voice stealing):

```ts
audio.registerSfx('jump', 4)          // up to 4 concurrent voices
audio.registerSfx('explosion', 6)

audio.playSfx('sfx', 'jump')          // next voice in the pool; steals oldest if all busy
```

#### Spatial audio (world-space pan + attenuation)

```ts
audio.setListener(camera.scrollX + width / 2, camera.scrollY + height / 2)

// Plays sfx_ping at (worldX, worldY); pan and volume attenuate with distance.
// range: distance at which volume reaches 0 (default 400).
audio.playSpatial('sfx', 'sfx_ping', worldX, worldY, /* range */ 300)
```

`playSpatial` uses the pool registered with `registerSfx`. Requires `registerSfx` before calling.

#### Ducking

Temporarily lower a bus (e.g. duck music while a VO plays):

```ts
// duck music to 15% volume, hold 1200ms, then restore over 600ms
audio.duck('music', 0.15, 1200, 600)
```

Multiple `duck` calls on the same bus restart the hold/restore cycle.

#### Debugger panel binding

Binds every bus to `AudioPanel` sliders so the in-game debugger reflects live bus state:

```ts
const dbg = scene.features.register('debugger', Debugger)
dbg.addPanel('audio', AudioPanel, 'Audio')

const audio = scene.features.register('audio', AudioFeature)
audio.bindDebugger(dbg)   // call after AudioPanel is added
```

#### Event constants

| Constant | Payload | Meaning |
|---|---|---|
| `AUDIO_MUSIC_START` | `(busName, key)` | A track started on a bus |
| `AUDIO_MUSIC_END` | `(busName)` | A track stopped on a bus |
| `AUDIO_BUS_CHANGE` | `(busName, bus)` | Bus sliders changed via panel |

```ts
import { AUDIO_MUSIC_START } from '@toolcase/phaser-plus'
scene.features.on(AUDIO_MUSIC_START, (bus, key) => hud.showNowPlaying(key))
```

#### Full wiring example

```ts
import { Scene, Debugger, AudioPanel, AudioFeature, AUDIO_MUSIC_START } from '@toolcase/phaser-plus'

class GameScene extends Scene {
    onInit() {
        this.pool.register('bullet', Bullet)
    }

    onLoad() {
        this.load.audio('music_main', 'assets/music_main.ogg')
        this.load.audio('music_battle', 'assets/music_battle.ogg')
        this.load.audio('sfx_shot', 'assets/sfx_shot.wav')
    }

    onCreate() {
        const dbg = this.features.register('debugger', Debugger)
        dbg.addPanel('audio', AudioPanel, 'Audio')

        const audio = this.features.register('audio', AudioFeature)
        audio.registerSfx('sfx_shot', 6)
        audio.setListener(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y)
        audio.bindDebugger(dbg)
        audio.play('music', 'music_main', true)

        this.features.on(AUDIO_MUSIC_START, (bus, key) => console.log('now playing', key))

        this.input.on('pointerdown', p => {
            audio.playSpatial('sfx', 'sfx_shot', p.worldX, p.worldY, 600)
        })
    }

    onUpdate() {
        const audio = this.features.get('audio')
        const mid = this.cameras.main.midPoint
        audio.setListener(mid.x, mid.y)
    }
}
```

#### Custom buses

Add extra buses beyond the four defaults:

```ts
audio.addBus('voice')          // volume/mute/pan default 1/false/0
audio.play('voice', 'npc_bark', false)
audio.duck('music', 0.2, 3000, 500)   // duck music while voice plays
```

Remove when done:

```ts
audio.removeBus('voice')       // stops and destroys current track on the bus
```

---

## Persistence — SaveService, PersistenceFeature, backends

Durable save-slot system backed by a pluggable `SaveBackend`. Stores versioned JSON envelopes and applies a migration chain when loading older saves.

### SaveService (ServiceRegistry singleton)

```ts
import { SaveService, LocalStorageBackend, MemoryBackend, IndexedDBBackend } from '@toolcase/phaser-plus'
import type { SaveSchema, SaveConfig } from '@toolcase/phaser-plus'
```

Construct via `engine.services.bind`:

```ts
scene.services.bind(SaveService, () => new SaveService({
    backend: new LocalStorageBackend('my-app'),   // default backend
    namespace: 'game',                            // namespaces keys within the backend
    schema: {
        version: 2,
        migrations: {
            1: (data) => ({ ...data, playerName: 'Hero' })  // v1 → v2
        }
    }
}))
```

`new SaveService()` (zero-arg) defaults to `LocalStorageBackend('phaser-plus')`, namespace `'save'`, schema version 1.

| Method | Returns | Description |
|---|---|---|
| `save(slotId, data)` | `Promise<void>` | Serialize `data` as a versioned envelope |
| `load<T>(slotId)` | `Promise<T \| null>` | Load + run migrations; `null` when slot missing |
| `delete(slotId)` | `Promise<void>` | Remove a slot |
| `list()` | `Promise<SaveEntry[]>` | All saved entries in this namespace |
| `has(slotId)` | `Promise<boolean>` | Check if a slot exists |
| `setSchema(schema)` | `this` | Replace schema at runtime |
| `dispose()` | `void` | Calls `backend.dispose()`; invoked automatically by `ServiceRegistry` |

`SaveEntry`: `{ id: string, version: number, savedAt: number }`.

### SaveBackend interface

```ts
interface SaveBackend {
    save(key: string, value: string): Promise<void>
    load(key: string): Promise<string | null>
    delete(key: string): Promise<void>
    keys(): Promise<string[]>
    dispose(): void
}
```

Three built-in backends:

| Class | Storage | Use for |
|---|---|---|
| `LocalStorageBackend(appPrefix?)` | `localStorage` | Default; up to ~5 MB |
| `IndexedDBBackend(dbName?)` | IndexedDB | Large saves, binary blobs |
| `MemoryBackend()` | `Map<string, string>` | Tests; volatile |

### PersistenceFeature

Scene-lifetime `Feature` that resolves `SaveService` from `engine.services` and forwards calls onto it with feature-bus events.

```ts
import { PersistenceFeature, SAVE_DONE, LOAD_DONE, SAVE_DELETED } from '@toolcase/phaser-plus'

// onInit: bind SaveService first
this.services.bind(SaveService, () => new SaveService({ namespace: 'game', schema }))

// onCreate: register the feature
const persistence = this.features.register('persistence', PersistenceFeature)

await persistence.save('slot-1', gameState)
const data = await persistence.load<GameState>('slot-1')
await persistence.delete('slot-1')
const entries = await persistence.list()

// listen for async completions on the feature bus
this.features.on(SAVE_DONE,    (slotId, data) => hud.refresh())
this.features.on(LOAD_DONE,    (slotId, data) => applyState(data))
this.features.on(SAVE_DELETED, (slotId)       => hud.refresh())
```

`persistence.service` exposes the raw `SaveService` for direct access.

### Migration chain (v1 → v2 → v3)

Each key in `migrations` is the source version to migrate FROM. The chain runs iteratively until `data._version === schema.version`:

```ts
const schema: SaveSchema = {
    version: 3,
    migrations: {
        1: (d) => ({ ...d, playerName: 'Hero' }),  // v1 → v2
        2: (d) => ({ ...d, highScore: 0 })          // v2 → v3
    }
}
```

A save made with version 1 passes through both migrators in order. Saves already at version 3 are returned unchanged.

### Worked example — save/load with tc-save-slot-list

```ts
import {
    Scene, HTMLFeature, SaveService, PersistenceFeature, LocalStorageBackend,
    LOAD_DONE, SAVE_DONE, SAVE_DELETED
} from '@toolcase/phaser-plus'

const SCHEMA: SaveSchema = {
    version: 2,
    migrations: { 1: (d) => ({ ...d, playerName: 'Hero' }) }
}

class HUD extends HTMLFeature {
    onCreate() {
        this.node.innerHTML = '<tc-save-slot-list id="slots" mode="load"></tc-save-slot-list>'
        const list = this.node.querySelector('#slots')
        list.onLoad = id => this.scene.features.get('p')?.load(id)
        list.onSave = id => this.scene.features.get('p')?.save(id, this.scene.state)
        list.onDelete = id => this.scene.features.get('p')?.delete(id)
    }
}

class GameScene extends Scene {
    onInit() {
        this.services.bind(SaveService, () => new SaveService({
            backend: new LocalStorageBackend('my-game'),
            namespace: 'game',
            schema: SCHEMA
        }))
    }
    onCreate() {
        const p = this.features.register('p', PersistenceFeature)
        this.features.register('hud', HUD)
        this.features.on(LOAD_DONE, (id, data) => applyState(data))
        this.features.on(SAVE_DONE, () => refreshSlots())
    }
}
```

---

## Cheat sheet

| Need | Do |
|---|---|
| Per-frame logic | Override `Scene.onUpdate` or `Feature.onUpdate` or `GameObject.onUpdate` |
| Spawn pooled object | `scene.pool.register(key, Cls)` once → `scene.pool.obtain(key)` |
| Render plane | `features.register('plane', Layer)` then `layer.depth = N` |
| Pooled spawn into a layer | `features.register('plane', ObjectLayer)` → `layer.add('key', x, y)` |
| Delayed event | `flow.events.add(name, EvCls)` → `flow.events.trigger(name, payload, delaySec)` |
| Recurring tick | `flow.timer.add(id, TimeEvCls, intervalSec, delaySec)` |
| Long task | `class extends Flow.Job` → `flow.jobs.run(JobCls, payload)` |
| Finite state machine | `class extends Flow.StateMachine<C>` → `addState/addTransition/setStart` |
| AI behavior tree | Build `Selector/Sequence/Action/...` → `Flow.BehaviorTreeProcessor.add(id, root, blackboard)` |
| Replay capture | `features.register('replay', Flow.ReplayRecorder)` → `record(seed, fps)` / `play(session)` |
| Cinematic camera | `features.register('cam', CameraDirector)` → `queue({...shot})` |
| Screen shake | `features.register('shake', ScreenShake)` → `shake.add/impact/rumble/sine` |
| Camera flash | `features.register('flash', CameraFlash)` → `flash.flash(0xffffff, 0.3)` |
| Dialog cue / NPC focus | `features.register('cue', DialogCameraCue)` → `cue.focus({x,y,width,height}, { vignette: true })` / `cue.clear()` |
| Delay / interval / sequence | `Flow.Timer.delay/interval/sequence(scene, ...)` |
| Concurrency cap | `Flow.Parallel.run(N, tasks, onAll)` |
| Throttle / debounce | `Flow.throttle(fn, ms)` / `Flow.debounce(fn, ms)` |
| Parallax | `features.register('bg', ParallaxLayer)` → `setFactor(...)` |
| Letterbox bars | `features.register('lb', LetterboxFeature)` → `setAspect(ratio)` |
| Action input | `features.register('input', InputFeature)` → `bind('jump', [...])` |
| Combo / forgiveness window | `features.register('buf', InputBuffer)` → `push` / `consume` |
| Touch gestures | `features.register('g', GestureRecognizer)` → listen `swipe`/`pinch`/`double-tap` |
| Mobile joystick | `features.register('stick', VirtualJoystick)` → `setInput(input)` → read `stick.vector.x` / `stick.vector.y` |
| Shader on object | `obj.effects.add(GrayScaleEffect, { ... })` |
| Isometric world | Extend `Scene2D`, set `world.projection = Matrix2.createISO(...)` |
| A* path | Extend `NavMesh` → register `PathFinder` → `findPath(...)` and listen `PATH_FOUND` |
| In-game UI | Register `Debugger` feature; add panels via `dbg.addPanel(key, PanelCls)` |
| Game-wide singleton | `engine.services.bind(Cls, factory)` then `engine.services.resolve(Cls)` |
| Audio bus mixer | `features.register('audio', AudioFeature)` → `play/crossfadeTo/playSfx/playSpatial/duck` |
| Music crossfade | `audio.crossfadeTo('music', 'boss_theme', 1200)` |
| SFX polyphony pool | `audio.registerSfx('shot', 6)` → `audio.playSfx('sfx', 'shot')` |
| Spatial SFX | `audio.setListener(x, y)` → `audio.playSpatial('sfx', 'shot', worldX, worldY, range)` |
| Duck a bus | `audio.duck('music', 0.15, holdMs, restoreMs)` |
| Bind panel | `audio.bindDebugger(dbg)` (after `dbg.addPanel('audio', AudioPanel)`) |
| Save slots | `services.bind(SaveService, () => new SaveService({...}))` → `features.register('p', PersistenceFeature)` |
| Save data | `persistence.save('slot-1', state)` |
| Load with migration | `persistence.load('slot-1')` (auto-migrates via schema.migrations) |
| Delete slot | `persistence.delete('slot-1')` |
| List slots | `persistence.list()` → `SaveEntry[]` |
| localStorage backend | `new LocalStorageBackend('app-prefix')` |
| IndexedDB backend | `new IndexedDBBackend('db-name')` |
| Test backend | `new MemoryBackend()` |

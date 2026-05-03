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
    Flow, // { Event, TimeEvent, CollisionEvent, Job, FlowEngine }
    Structs, // { Matrix2 }
    LogLevel,
    Debugger, Panel,
    PerformancePanel, MemoryPanel, TimelinePanel,
    InputPanel, AudioPanel, NetPanel,
    ConsoleCommands, HotReload, RemoteDebugger,
    Scene2D, World, GameObject2D, Grid,
    Effect, EffectManager, installEffects, EFFECT_REGISTRY,
    NavMesh, PathFinder, Path, PathNode, PathIterator,
    PATH_FOUND, PATH_FAILED
} from '@toolcase/phaser-plus'
```

Peers: `phaser@4.x`, `@toolcase/base@2.x`, `@toolcase/logging@2.x`.

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

Per-Scene singleton wrapping a `LoggerFactory` and a `ServiceRegistry`. Created automatically.

| Member | Type | Description |
|---|---|---|
| `version` | `string` | Engine version string |
| `services` | `ServiceRegistry` | Game-wide DI container |
| `setLogLevel(level)` | `this` | `level` is a `LogLevel` enum value |
| `getLogger(scope?)` | `Logger` | Scoped logger from `@toolcase/logging` |

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

scene.flow.physics?.addProcessor /* … */
```

(See source for processor-specific `add` API; physics is optional.)

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
t.addTag('walkable')
```

Use `setTransform / setTransformX / setTransformY` to move in world space — they apply the World's projection automatically.

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
const custom = Structs.Matrix2.create(64, 32, Math.PI / 6, -Math.PI / 6)

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

ensureEffectRegistered(game, MyEffect) // or installEffects covers built-ins
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
    // 'blocked' | 'exhausted'
})
```

`Path` instances are pooled — copy any data you need before `'found' / 'failed'` listeners return. Heuristic is octile (8-connectivity). `PathNode`, `PathIterator` are exposed for custom integrations but normally not needed.

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
| Shader on object | `obj.effects.add(GrayScaleEffect, { ... })` |
| Isometric world | Extend `Scene2D`, set `world.projection = Matrix2.createISO(...)` |
| A* path | Extend `NavMesh` → register `PathFinder` → `findPath(...)` and listen `PATH_FOUND` |
| In-game UI | Register `Debugger` feature; add panels via `dbg.addPanel(key, PanelCls)` |
| Game-wide singleton | `engine.services.bind(Cls, factory)` then `engine.services.resolve(Cls)` |

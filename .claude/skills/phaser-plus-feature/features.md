# Existing `@toolcase/phaser-plus` API

Reference inventory for everything currently exported from `phaser-plus/src/index.ts`. Use to pick the right base class before scaffolding a new one. **Reuse before reinvent.**

Source of truth: `phaser-plus/src/index.ts` exports + `examples/public/phaser-plus/SKILL.md`. Stale ⇒ refresh.

---

## Engine & Scene

### `Engine` — per-Scene singleton

Wraps a `LoggerFactory` + `ServiceRegistry`. Created automatically.

| Member | Purpose |
|---|---|
| `version: string` | engine version |
| `services: ServiceRegistry` | game-wide DI |
| `setLogLevel(level)` | sets logging level via `LogLevel` enum |
| `getLogger(scope?)` | scoped logger |

### `Scene` — base scene

`extends Phaser.Scene`. Provides registries.

| Member | Type |
|---|---|
| `engine` | `Engine` |
| `services` | `ServiceRegistry` |
| `features` | `FeatureRegistry` |
| `pool` | `GameObjectPool` |
| `flow` | `FlowEngine` |
| `payload` | `Record<string, any>` (data from `goTo`) |

**Lifecycle hooks (override):** `beforeInit`, `onInit`, `onLoad`, `onCreate`, `onUpdate(time, delta)`, `onDestroy`.

**Navigation:** `goTo(key, data?)`, `restart(data?)`, `pause()`, `resume()`.

**Use when:** any new scene. **Don't override** Phaser's `init/preload/create/update` — engine already does.

---

## GameObject

### `GameObject` — Container with id + hooks

Phaser `Container` extension with stable `id`, lazy `EffectManager`, absolute-position helper.

| Member | Notes |
|---|---|
| `id: string` | unique |
| `effects: EffectManager` | lazy |
| `absolute: Phaser.Math.Vector2` | cached world position |
| `getAbsolute(out?)` | computes into `out` |
| `add(child)` / `remove(child, destroy?)` | with `onAdd` callback support |

**Hooks:** `onCreate`, `onAdd`, `onUpdate`, `onRemove`, `onDestroy`.

**`onUpdate` only ticks when GameObject is direct child of scene.** Nested children must tick manually.

**Use when:** any custom in-game entity (player, bullet, prop).

---

## Features

### `Feature` — scene-lifetime module

Constructor `(scene: Scene, key: string)`. Registered via `scene.features.register(key, FeatureClass)`.

| Hook | Purpose |
|---|---|
| `onCreate()` | setup |
| `onUpdate(time, delta)` | per-frame |
| `preDestroy()` | early teardown phase |
| `onDestroy()` | cleanup |
| `emit(event, ...args)` | dispatch on registry's broadcast bus |

**Use when:** any scene-lifetime module that's not a `GameObject`.

---

### `FeatureRegistry`

`scene.features`. Doubles as a `Broadcast` event bus.

| Method | Returns |
|---|---|
| `register<T>(key, Cls)` | `T` |
| `get<T>(key)` | `T \| null` |
| `has(key)` | `boolean` |
| `destroy(key)` / `destroyAll()` | `void` |
| `keys` / `size` | inventory |

**Listen for events:** `features.on('event_name', fn)`.

---

### `ServiceRegistry`

Game-lifetime DI. `engine.services`.

| Method | Notes |
|---|---|
| `bind(Cls, factory)` | lazy |
| `provide(Cls, instance)` | pre-built |
| `resolve<T>(Cls)` | lazy / cached |
| `has(Cls)` | bool |
| `dispose(Cls)` / `disposeAll()` | cleanup |

**Use when:** any singleton that survives across scenes.

---

### `Layer` — Feature with own camera + root container

| Member | Purpose |
|---|---|
| `container: GameObject` | root container |
| `camera` | owned `Phaser.Cameras.Scene2D.Camera` |
| `cameraFilter` | bitmask excluding other cameras |
| `list / count` | children of `container` |
| `visible` (get/set) | toggle |
| `depth` (get/set) | sets camera + container depth |
| `setBackgroundColor(color)` | |
| `centerOn(x, y)` | scroll camera |
| `getByName<T>(name)` | child lookup |
| `clear()` | remove children without destroying |

**Use when:** any new render plane (background, world, UI).

---

### `ObjectLayer` — Layer + pooled spawning

`scene.features.register('game', ObjectLayer)` → `layer.add<T>(key, x, y)` (calls `scene.pool.obtain`). `layer.remove(obj)` releases. `layer.clear()` releases all.

**Use when:** scene-lifetime layer that spawns pooled GameObjects.

---

### `HTMLFeature` — DOM overlay

DOM `<div>` overlaid on the canvas. Requires `dom: { createContainer: true }` in game config.

```ts
class Hud extends HTMLFeature {
    onCreate() { this.node.innerHTML = '<div class="hud">…</div>' }
}
```

**Use when:** HUDs / overlays composed of HTML or `gc-*` web components. **Skip when:** pure WebGL UI (use a UI `Layer`).

---

### `SplitScreen` — adaptive 2-camera follow

`split.setSplitThresholds(enter, merge)` + `split.follow(targetA.position, targetB.position)`. Cameras at `split.cameras.{ui, A, B}`.

**Use when:** local 2-player camera; auto switches between single and split based on distance.

---

## Pool

### `GameObjectPool` — scene.pool

`register<T>(key, Cls, instanceFn?, resetFn?)`. `obtain<T>(key)` calls `onCreate()` once per instance. `release(obj)` runs `resetFn`. `count(key)` / `instances` / `dispose()`.

**Use when:** any GameObject spawned per-frame. **Pooled GameObjects gain `release()` closure** — never `destroy()` them manually.

---

## Flow

### `FlowEngine` — scene.flow

Holds processors. `flow.active = false` pauses all. `flow.addProcessor(eventType, ProcessorClass)` plugs in custom processors.

| Processor | Field | Built-ins |
|---|---|---|
| `EventProcessor` | `flow.events` | named one-shot events |
| `TimeEventProcessor` | `flow.timer` | repeating intervals |
| `JobProcessor` | `flow.jobs` | cooperative long-running |
| `CollisionEventProcessor` | `flow.physics` | matter collisions (when `scene.matter` exists) |

---

### `Flow.Event` — named, optionally delayed event

Subclass + override `onFire(payload)`. Register via `flow.events.add(name, EvCls)`. Trigger via `trigger(name, payload?, delaySec?)` / `triggerNow(name, payload?)` / `triggerFn(fn, delaySec?)`. Methods: `replace`, `remove`, `has`, `keys`.

### `Flow.TimeEvent` — recurring tick

Subclass + override `onFire(times)`. `flow.timer.add(id, TimeEvCls, intervalSec, delaySec?)`.

### `Flow.Job` — long-running task

Subclass + override `onUpdate(time)` returning `true` on completion. Register via `flow.jobs.run(JobCls, payload?)`. `flow.jobs.maxJobsPerFrame`, `queuedJobs`. Throwing → `onTerminate(error)`.

### `Flow.CollisionEvent` — matter physics listener

Subclass + override `onEnter` / `onExit`. Auto-bound when `scene.matter` exists.

### `Flow.StateMachine<C>` — finite state machine

Constructor `(scene, key)` — registered as a Feature. Fluent: `setContext`, `addState(name, { onEnter?, onExit?, onUpdate? })`, `addTransition(from, to, on?, guard?)`, `setStart(name)`, `fire(signal)`, `go(target)`, `is(name)`, `current`. Listen `STATE_ENTER` / `STATE_EXIT` / `STATE_TRANSITION`.

### `Flow.BehaviorTreeProcessor` + `Flow.BT.*` — behavior trees

Nodes: `Sequence`, `Selector`, `Parallel`, `Action`, `Condition`, `Inverter`, `Repeater`, `AlwaysSucceed`, `AlwaysFail`. Status `'success' | 'failure' | 'running'`. Register processor and add trees.

### `Flow.Timer` — delay / interval / sequence sugar

Static helpers wrapping `flow.events.triggerFn` and `flow.timer.add` so callers don't subclass `Job`/`TimeEvent`. `Timer.delay(scene, sec, fn)`, `Timer.interval(scene, sec, fn)`, `Timer.sequence(scene, steps)`. Returns a handle: `cancel`, `pause`, `resume`, `cancelled`.

### `Flow.Parallel` — bounded-concurrency runner

`Flow.Parallel.run(N, tasks, onAll?)` runs at most `N` of `tasks` concurrently (`N <= 0` means unlimited). Each task takes a `done` callback. Handle: `cancel`, `running`, `remaining`, `done`. Independent of Phaser — pure JS.

### `Flow.throttle` / `Flow.debounce`

Pure JS function wrappers. `throttle(fn, ms, { leading?, trailing? })`, `debounce(fn, ms, { leading? })`. Independent of Phaser.

### `Flow.ReplayRecorder` — input capture/playback

Modes: `'idle' | 'recording' | 'playing'`. `startRecording({ seed, fps })`, `record(input)`, `stop()`, `startPlaying(session)`. Events `replay.frame`, `replay.end`.

---

## Debugger

### `Debugger` — `HTMLFeature` exposing Tweakpane

Requires `dom: { createContainer: true }`. Methods: `setExpanded(bool)`, `inspect(go)`, `addPanel(key, PanelCls)`, `removePanel(key)`, `getPanel<T>(key)`.

**Built-in panels (always present):** `inspector`, `overview`, `flow`, `layer`, `gameObject`.
**Registerable panels:** `PerformancePanel`, `MemoryPanel`, `TimelinePanel`, `InputPanel`, `AudioPanel`, `NetPanel`.
**Built-in tools (also `Panel`):** `ConsoleCommands`, `HotReload`, `RemoteDebugger`.

### `Panel` — base for custom panels

Subclass + override `draw()`, `doUpdate()`, `dispose()`. `this.base` is a Tweakpane folder with the essentials plugin (blades `fpsgraph`, `text`, `separator`).

---

## Perspective2D

### `Scene2D` — `Scene` with preset `world` + `ui`

Protected: `this.world: World`, `this.ui: ObjectLayer`.

### `World` — Layer with projection + depth-sort

| Member | Notes |
|---|---|
| `projection: Matrix2` | world→screen |
| `register<T>(key, Cls)` | pool-backed |
| `add<T>(key, x, y)` | spawn at world `(x, y)` |
| `remove<T>(obj)` | release to pool |
| `clear()` | release all |
| `debug(flag?, colors?)` | toggle iso grid overlay |

### `GameObject2D` — projection-aware GameObject

`setTransform(x, y)` / `setTransformX` / `setTransformY` → re-project automatically. `addTag(name)`.

### `Grid` — debug grid overlay (used internally by `World.debug`)

### `Structs.Matrix2` — 2×2 transform

`Matrix2.create(a, b, c, d)`, `Matrix2.createISO(tile)`. Methods: `translate(x, y, out)`, `adjoint`, `inverse`, `determinant`, `setValues`.

---

## Effects

### `Effect` — base shader filter

Subclass + set `static KEY` + `static FRAGMENT`. Override `applyUniforms(programManager, time)`.

### `EffectManager` — `obj.effects`

Lazy. `add(EffectCls, opts?)`, `list`, `remove(fx)`, `clear()`.

### Bootstrapping

`installEffects(game)` registers all built-ins. `ensureEffectRegistered(game, MyEffect)` for one-offs. `EFFECT_REGISTRY` enumerates the built-ins.

### Built-in shader registry (`EFFECT_REGISTRY`)

**Color:** `GrayScaleEffect`, `NegativeEffect`, `PosterizeEffect`, `ThresholdEffect`, `ColorRGBEffect`, `ColorEffect`, `HSVEffect`, `ColorChangeEffect`, `SepiaEffect`, `MetalFXEffect`, `GoldFXEffect`, `GoldenFXEffect`, `IcedFXEffect`, `SandFXEffect`, `StoneFXEffect`, `WoodFXEffect`.

**Procedural:** `NoiseEffect`, `NoiseAnimatedEffect`, `BloodEffect`, `BurningFXEffect`, `FireEffect`, `FireAdditiveEffect`, `SmokeEffect`, `FrozenEffect`, `IceEffect`, `LightningEffect`, `LightningBoltEffect`, `PlasmaRainbowEffect`, `PlasmaShieldEffect`.

**Distortion:** `BlackHoleEffect`, `TwistEffect`, `DistortionEffect`, `DistortionAdditiveEffect`, `WaveEffect`, `MysticDistortionEffect`, `MysticDistortionAdditiveEffect`, `HeatEffect`, `JellyEffect`, `JellyAutoMoveEffect`, `LiquidEffect`, `LiquifyEffect`, `SlimEffect`.

**Dissolve:** `DesintegrationFXEffect`, `DestroyedFXEffect`, `CompressionFXEffect`, `PixelEffect`, `Pixel8BitsBlackEffect`, `Pixel8BitsCommodoreEffect`, `Pixel8BitsGameboyEffect`.

**Mask:** `CircleFadeEffect`, `ClippingEffect`, `EnergyBarEffect`, `GhostEffect`, `FourGradientsEffect`, `AdditiveEffect`, `TeleportationEffect`, `CartoonEffect`.

**Lighting:** `OutlineEffect`, `PatternEffect`, `PatternAdditiveEffect`, `EdgeColorEffect`, `BlurEffect`, `SharpenEffect`, `GrassFXEffect`, `GrassMultiFXEffect`, `HologramEffect`, `Hologram2Effect`, `Hologram3Effect`, `ShinyReflectEffect`, `SkyCloudEffect`, `WaterAndBackgroundEffect`, `WaterAndBackgroundDeluxeEffect`, `WaterfallEffect`.

---

## AI / Pathfinding

### `NavMesh` — base mesh (extend)

Override `isBlocked(x, y)` and `cost(x, y)`.

### `PathFinder` — Feature

`features.register('pf', PathFinder)`. `setMesh(mesh)`, `budgetMs`, `findPath(sx, sy, ex, ey, maxIterations?)` returns `Path`. `Path` emits `PATH_FOUND` (waypoints[]) / `PATH_FAILED` (`'blocked' | 'exhausted'`). Heuristic: octile (8-connectivity).

### `Path`, `PathNode`, `PathIterator`

Pooled `Path` instances — copy data before listeners return. `PathIterator` exposed for custom integrations.

---

## Cinema

### `CameraDirector` — Feature

`setCamera(camera)`. `queue(shot)` accepts `FollowShot | PanShot | ZoomShot | BoundsShot | SplineShot`. `skip()`, `clear()`. Easing exports: `EASE_LINEAR`, `EASE_IN_OUT`, `EASE_OUT`. Emits `SHOT_DONE`.

### `ScreenShake` — Feature

Trauma-based. `setMaxOffset(px)`, `setMaxAngle(rad)`, `setExponent(n)`. `setCamera(camera)` to bind. Multiple sources stack and overlay across two modes:

- **random** (default): `add(trauma, decaySec)`, `impact(trauma)`, `rumble(intensity, durationSec)` — random per-frame offset.
- **sine**: `sine(intensity, freqHz, durationSec)` — deterministic sine wobble.

`clear()` removes all active sources.

### `CameraFlash` — Feature

Fullscreen color overlay (`Phaser.GameObjects.Rectangle`, screen-space, depth 1100 by default). `flash(color, durationSec, holdSec=0)` queues a fade; multiple flashes blend (weighted RGB, summed alpha clamped). `setDepth(z)`, `clear()`.

### `ParallaxLayer` — Layer

`setFactor(x, y?)`, `setReference(camera)`, `setAutoTile(w, h, flag?)`, `addTiled(child)`. Auto-tiles for infinite backgrounds.

### `LetterboxFeature` — Feature

`show(size, sec)`, `hide(sec)`. Cinematic bars.

---

## Input

### `InputFeature` — Feature

`bind(action, bindings[])`. Bindings: `{ type: 'key', code }`, `{ type: 'mouse', button: 0|1|2 }`, `{ type: 'gamepad', button, pad? }`, `{ type: 'axis', axis, threshold?, direction? }`, `{ type: 'virtual', id }`. Emits `ACTION_PRESS`, `ACTION_RELEASE`, `ACTION_HOLD`. Queries: `isPressed(action)`, `holdMs(action)`.

### `InputBuffer` — Feature

Combo / leniency window. `setCapacity(n)`, `setWindow(ms)`. `push(action, time?, payload?)`, `consume(action, withinMs?, now?)` (removes), `peek(action, withinMs?, now?)` (keeps).

### `GamepadFeature` — Feature

`setDeadzone(threshold)`. `isConnected(pad)`, `vibrate(pad, strong, weak, ms)`.

### `GestureRecognizer` — Feature

Touch-input gestures. Emits `swipe` ({direction, length}), `double-tap` ({x, y}), `pinch` ({scale}).

### `VirtualJoystick` — Feature

On-screen analog stick. `setPosition(x, y)`, `setRadius(r)`. Read `stick.x` / `stick.y`. Pairs with `InputFeature` `'virtual'` binding.

---

## Logging level

### `LogLevel` — re-export from `@toolcase/logging`

Use `engine.setLogLevel(LogLevel.DEBUG)`.

---

## Decision quick map

| Need | Reach for |
|---|---|
| Per-frame logic on a module | `Feature` subclass |
| Render plane | `Layer` subclass |
| Pool-backed render plane | `ObjectLayer` |
| DOM overlay | `HTMLFeature` |
| Custom flow processor | `FlowProcessor` subclass |
| Delayed event | `Flow.Event` + `flow.events.trigger` |
| Recurring tick | `Flow.TimeEvent` + `flow.timer.add` |
| Long task | `Flow.Job` + `flow.jobs.run` |
| FSM | `Flow.StateMachine<C>` |
| Behavior tree | `Flow.BT.*` + `Flow.BehaviorTreeProcessor` |
| Replay capture | `Flow.ReplayRecorder` |
| Cinematic camera | `CameraDirector` |
| Screen shake | `ScreenShake` |
| Parallax | `ParallaxLayer` |
| Letterbox bars | `LetterboxFeature` |
| Action binding | `InputFeature` |
| Combo window | `InputBuffer` |
| Touch gestures | `GestureRecognizer` |
| Mobile joystick | `VirtualJoystick` |
| Gamepad polling/vibration | `GamepadFeature` |
| Shader on object | `Effect` subclass + `obj.effects.add` |
| Isometric world | extend `Scene2D` + `Matrix2.createISO` |
| A* path | extend `NavMesh` + register `PathFinder` |
| In-game UI | `Debugger` + custom `Panel` |
| Game-wide singleton | `engine.services.bind` / `provide` / `resolve` |

---

## Composition examples

These already exist — copy the pattern.

- **Side-scroller scene:** `Layer` (bg) + `ObjectLayer` (game) + `Flow.TimeEvent` (spawn) + `Flow.Event` (boss intro) + `Effect` (outline on hero).
- **Isometric world:** `Scene2D` + `Matrix2.createISO(64)` + `World.register('tile', Tile)`.
- **AI mob:** `Flow.StateMachine<C>` driven by `Flow.Event` signals.
- **Pathfinding mob:** `NavMesh` subclass + `PathFinder` feature + `PATH_FOUND` listener.
- **HUD overlay:** `HTMLFeature` hosting `gc-*` web components, bound per-frame in `onUpdate`.
- **Multiplayer netcode tick:** `Flow.Event` carrying serialized payload via `@toolcase/serializer`, dispatched on websocket message.

When you compose, document under "Reuses" in your new feature's `features.md` entry.

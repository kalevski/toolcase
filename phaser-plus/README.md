# @toolcase/phaser-plus

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/phaser-plus?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/phaser-plus)

🕹 An opinionated **runtime layer for [Phaser 4](https://phaser.io)**. Adds the structure that Phaser leaves to you: scene lifecycle, feature registry, service DI, object pool, flow events / timers / jobs, layer-per-camera rendering, isometric/perspective2d, GLSL shader effects, A* pathfinding, an in-game **Tweakpane** debugger, and more — behind a single import.

📖 Full API reference: **[toolcase.kalevski.dev/phaser-plus](https://toolcase.kalevski.dev/phaser-plus)** · [SKILL.md](https://toolcase.kalevski.dev/phaser-plus/SKILL.md)

## Why

Phaser is excellent at rendering and input. It does not prescribe how to organise scenes, share systems across them, batch timers, manage object pools, or layer cameras. `phaser-plus` answers those questions in one consistent way so you can stop re-inventing scene plumbing on every project.

## Install

```bash
npm install @toolcase/phaser-plus phaser
```

### Peer dependencies

- `phaser ^4.x`
- `@toolcase/base ^3.x`
- `@toolcase/logging ^3.x`
- `react`, `react-dom` (optional — only required if you embed the `Debugger` panel React UI)

## Quick start

```ts
import { Game, AUTO } from 'phaser'
import { Scene, ObjectLayer, GameObject, installEffects } from '@toolcase/phaser-plus'

class Player extends GameObject {
    onCreate() {
        const sprite = this.scene.add.sprite(0, 0, 'hero')
        this.add(sprite)
    }
    onUpdate(_time, delta) { /* per-frame */ }
}

class GameScene extends Scene {
    onInit() {
        this.pool.register('player', Player)
    }
    onCreate() {
        const layer = this.features.register('main', ObjectLayer)
        layer.add<Player>('player', 100, 100)
    }
}

const game = new Game({
    type: AUTO,
    width: 960,
    height: 540,
    dom: { createContainer: true }, // required for Debugger / HTMLFeature
    scene: [GameScene]
})

installEffects(game) // registers all built-in shader effects
```

> **Lifecycle contract:** subclass `Scene` and override `beforeInit / onInit / onLoad / onCreate / onUpdate / onDestroy`. Don't override Phaser's `init / preload / create / update` — `phaser-plus` uses them internally.

## What's in the box

| Area | Highlights |
|------|------------|
| **Engine & Scene** | `Engine` per-scene singleton, `Scene` with `engine / services / features / pool / flow` registries and clean lifecycle hooks. Navigation: `goTo`, `restart`, `pause`, `resume`. |
| **GameObject** | Phaser `Container` extension with stable `id`, lazy `EffectManager`, absolute-position helper, and lifecycle hooks. |
| **Features & services** | `FeatureRegistry` for scene-lifetime modules (with built-in event bus) + `ServiceRegistry` for game-lifetime DI. |
| **Layers** | `Layer` (one camera + container per visual plane), `ObjectLayer` (pool-backed spawn/release), `HTMLFeature` (DOM overlay), `SplitScreen` (adaptive single↔split co-op cameras). |
| **Pooling** | `GameObjectPool` — register, obtain, release; integrates with `ObjectLayer`. |
| **Flow** | `FlowEngine` — `Event`, `TimeEvent`, `Job`, `Timer`, `Parallel`, `CollisionEvent`, plus `throttle`/`debounce`. The "tween-but-for-game-logic" piece. |
| **Debugger** | Tweakpane-powered in-game panel — `PerformancePanel`, `MemoryPanel`, `TimelinePanel`, `InputPanel`, `AudioPanel`, `NetPanel`, plus `ConsoleCommands`, `HotReload`, `RemoteDebugger`. |
| **Perspective2D** | `Scene2D` / `World` / `GameObject2D` / `Grid` — opinionated isometric/grid scene type with `Matrix2`. |
| **Effects** | GLSL `Effect` system — `EffectManager`, `installEffects`, `EFFECT_REGISTRY`. |
| **AI / Pathfinding** | `NavMesh`, `PathFinder`, `Path`, `PathNode`, `PathIterator`. A* over arbitrary navmesh graphs. |
| **Camera director** | `CameraDirector`, `ScreenShake`, `CameraFlash`, `DialogCameraCue`, `ParallaxLayer`, `LetterboxFeature`. |

```ts
import {
    Engine, Scene, GameObject, Events,
    Feature, FeatureRegistry, ServiceRegistry,
    Layer, ObjectLayer, HTMLFeature, SplitScreen,
    GameObjectPool,
    Flow,
    Structs,
    LogLevel,
    Debugger, Panel,
    PerformancePanel, MemoryPanel, TimelinePanel,
    InputPanel, AudioPanel, NetPanel,
    ConsoleCommands, HotReload, RemoteDebugger,
    Scene2D, World, GameObject2D, Grid,
    Effect, EffectManager, installEffects, EFFECT_REGISTRY,
    NavMesh, PathFinder, Path, PathNode, PathIterator,
    PATH_FOUND, PATH_FAILED,
    CameraDirector, ScreenShake, CameraFlash,
    DialogCameraCue, ParallaxLayer, LetterboxFeature
} from '@toolcase/phaser-plus'
```

## Common patterns

### Spawn a pooled GameObject from an `ObjectLayer`

```ts
class Battle extends Scene {
    onInit() { this.pool.register('enemy', Enemy) }
    onCreate() {
        this.world = this.features.register('world', ObjectLayer)
    }
    spawnEnemy(x: number, y: number) {
        return this.world.add<Enemy>('enemy', x, y)
    }
}
```

### Schedule logic with `Flow` instead of `setTimeout`

```ts
this.flow.timer(500).then(() => boss.attack())
this.flow.job(function* (ctx) {
    yield ctx.wait(200);  showText('Ready?')
    yield ctx.wait(800);  showText('Go!')
})
```

### Add an in-game debug panel

```ts
import { Debugger, PerformancePanel } from '@toolcase/phaser-plus'

const dbg = this.features.register('debugger', Debugger)
dbg.addPanel(new PerformancePanel())
```

### Apply a shader effect

```ts
hero.effects.add('glow', { color: 0x00ffff, intensity: 1.4 })
```

## ESM-only

`phaser-plus` ships **ESM only** (`"type": "module"`). Use a modern bundler (Vite, esbuild, Rollup, webpack 5) or a runtime that supports native ESM. It targets Node ≥ 18 for tooling.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)

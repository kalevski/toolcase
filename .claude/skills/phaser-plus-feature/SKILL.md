---
name: phaser-plus-feature
description: Add a new feature, Layer, FlowProcessor, Effect, Panel, Cinema piece, Input device, or AI primitive to `@toolcase/phaser-plus`. Triggers when the user asks to add/create/scaffold a new export inside `phaser-plus/src/` (e.g. "add a Tilemap feature", "ship a new shader effect", "add a new debugger panel", "implement screen-shake shake variant"). Wires up the `.ts` file, registry, public exports, and the inventory + downstream SKILL.md.
---

# phaser-plus-feature

Scaffold a new feature in `@toolcase/phaser-plus`. Typical additions: subclasses of `Feature` / `Layer` / `HTMLFeature` / `Panel` / `FlowProcessor` / `Effect` / `Path*` / `BTNode`. Composes with Phaser 4, `@toolcase/base`, and `@toolcase/logging`.

## REQUIRED reading before generating any code

**You MUST read three files in this order:**

1. **`.claude/skills/phaser-plus-feature/features.md`** (bundled) — inventory of every existing class/registry/event in `@toolcase/phaser-plus`. **Reuse before reinvent.**
2. **`.claude/skills/phaser-plus-feature/conventions.md`** (bundled) — Scene lifecycle hooks, Feature pattern, registry wiring, broadcast events, ESM-only build constraints.
3. **`examples/public/phaser-plus/SKILL.md`** — the user-facing API reference at `toolcase.kalevski.dev/phaser-plus/SKILL.md`. The downstream contract — anything you add must be appended here too.

Do not paraphrase. Open all three. Locate the matching subsystem (engine / features / pool / flow / effects / debugger / perspective2d / cinema / input / ai). Copy the exact constructor signature, hook names (`onCreate`/`onUpdate`/`onDestroy`), and registry-attachment pattern from the matching existing code.

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md`. Concrete checks:

- Per-frame logic on a scene-lifetime module? Subclass **existing** `Feature` — don't introduce a new lifetime concept.
- Need a render plane / camera? Subclass **existing** `Layer` (or `ObjectLayer` for pool-backed). Don't write a new camera owner.
- Need a DOM overlay? Subclass **existing** `HTMLFeature`. Don't bypass and use `scene.add.dom` directly.
- Need a flow processor? Subclass **existing** `FlowProcessor` and register via `scene.flow.addProcessor`. Don't add a sibling processor field.
- Need a debugger panel? Subclass **existing** `Panel` and register via `dbg.addPanel`. Don't fork the debugger.
- Need a shader effect? Subclass **existing** `Effect` (set `static KEY` + `static FRAGMENT`). Register via `installEffects(game)` or attach with `EffectManager.add(MyEffect)` (lazy-registers on first add). Don't write a new filter pipeline.
- Need pathfinding? Subclass **existing** `NavMesh` (override `isBlocked` / `cost`). Use **existing** `PathFinder` feature.
- Need state machine? Use **existing** `Flow.StateMachine`. Don't write a new FSM.
- Need behavior tree? Compose **existing** `Flow.BT.{Sequence, Selector, Action, Condition, Inverter, Repeater, Parallel, AlwaysSucceed, AlwaysFail}` nodes. Use **existing** `Flow.BehaviorTreeProcessor`.
- Need scoped logger? Use `scene.engine.getLogger(scope)` — do not import `@toolcase/logging` directly inside `phaser-plus/src/` (the engine wraps it).
- Need a game-wide singleton? Use **existing** `engine.services.bind` / `provide` / `resolve`. Don't add module-level state.
- Need pooling for a `GameObject`? Use **existing** `scene.pool.register` + `obtain` / `release`. Never `new` then `destroy` for hot objects.
- Need camera shots? Use **existing** `CameraDirector.push(shot)` (queue) or `.cut(shot)` (interrupt). Don't tween cameras manually.
- Need screen shake? Use **existing** `ScreenShake.add(trauma, decay)`.
- Need parallax? Use **existing** `ParallaxLayer`.
- Need input mapping? Use **existing** `InputFeature.bind('action', [...])`.
- Need combo/leniency window? Use **existing** `InputBuffer.consume(action, ms)`.

If your feature would duplicate >50% of an existing class, **stop and either subclass it or compose it** instead of adding a new sibling.

## When to use

Trigger on requests like:

- "add a [Feature | Layer | Panel | Effect | FlowProcessor | NavMesh] subclass"
- "ship a new shader effect"
- "implement a Tilemap feature for phaser-plus"
- "add a new debugger panel"
- "extend Cinema with [variant]"
- any request mentioning `phaser-plus/src/`, `@toolcase/phaser-plus`, Phaser 4 runtime additions, or scene-lifetime modules

Do NOT use for:

- Edits to existing files (just edit them — rules below still apply for export placement and inventory updates).
- Anything that doesn't depend on Phaser (use `base-feature` for generic primitives).
- Logging additions (use `logging-feature`).
- Wire-format additions (use `serializer-feature`).
- React/UI components (use `react-component` or `gc-component`).

## Hard rules

These come from `phaser-plus/package.json` (peers `phaser@4.x`, `@toolcase/base@3.x`, `@toolcase/logging@3.x`, optional `react`/`react-dom` ≥18, ESM-only) and the patterns every existing class follows.

1. **ESM-only.** `phaser-plus/package.json` declares `"type": "module"` and a single ESM `import` export. Don't add CJS code paths.
2. **Peer deps only.** Never add a new runtime dep without a strong reason. Tweakpane is the only non-peer dep — it's tightly coupled to the debugger.
3. **TypeScript class per file.** PascalCase classname → `PascalCase.ts`. Filename matches export.
4. **Default export = canonical class.** Named re-export at the bottom for type aliases / event constants.
5. **Subsystem groups live in subfolders with their own `index.ts`** that re-exports for the top-level `phaser-plus/src/index.ts`. Established subsystems: `engine/`, `features/`, `pool/`, `flow/`, `effects/`, `debugger/`, `perspective2d/`, `cinema/`, `input/`, `ai/`, `math/`.
6. **Top-level `phaser-plus/src/index.ts` is the export gateway.** Either add a direct export or extend an existing namespace (`Flow`, `Structs`, `Events`). For new subsystems, follow the `cinema/` / `input/` pattern: `export * from './<group>'` in `index.ts`.
7. **Lifecycle hooks are fixed.** `onCreate`, `onUpdate(time, delta)`, `onDestroy`. For Features that participate in scene destruction, also `preDestroy()`. Never override Phaser's own `init / preload / create / update`.
8. **`Feature` constructor takes `(scene, key)`** — match `Feature.ts`. The `key` is what `scene.features.register(key, FeatureClass)` passed in.
9. **Scoped logger from engine.** Use `this.scene.engine.getLogger('<scope>')`. Don't import `@toolcase/logging` directly.
10. **Strict TypeScript.** Use the existing public types (`Phaser.Cameras.Scene2D.Camera`, `Phaser.GameObjects.GameObject`). No `any` in public surface.
11. **Tests are mandatory** when behavior is testable without a Phaser game instance (math helpers, processors that operate on plain data). UI features that need a running Phaser instance ship without tests but with a working demo in `examples/`.
12. **No code comments.** Match the existing style.
13. **No semicolons. 4-space indent.** Match the existing style across `phaser-plus/src/`.
14. **Dispatch broadcast events via `this.emit(name, ...args)`** inside a `Feature` subclass (`Feature.emit` is protected). Consumers listen via `scene.features.on(name, fn)`. Never `scene.events.emit` for feature-internal signals.
15. **Update `examples/public/phaser-plus/SKILL.md`.** Append a section in the matching category (Engine & Scene / GameObject / Features / Flow / Cinema / Input / AI / Effects / Worked examples / Cheat sheet).
16. **Update `features.md`.** Append the inventory entry.
17. **Demo is mandatory.** Every new export ships with a runnable Phaser scene at `examples/src/phaser-plus/scenes/<Name>.js` registered in `examples/src/phaser-plus/index.tsx` (`phaserExamples` entry: `key`, `title`, `category`, `description`, `sceneFile`, `element: <PhaserCanvas sceneClass={<Name>} />`). No demo = feature not done. Phaser features need a running scene to verify behavior — the demo *is* the verification.

## Files to create / modify per feature

For a new export named `<Name>` in subsystem `<group>`:

1. **`phaser-plus/src/<group>/<Name>.ts`** — implementation. `export default <Name>`.
2. **`phaser-plus/src/<group>/index.ts`** — append the re-export.
3. **`phaser-plus/src/index.ts`** — verify the subsystem is wired (`export * from './<group>'`). For new subsystems, add it.
4. **`examples/public/phaser-plus/SKILL.md`** — append API section.
5. **`.claude/skills/phaser-plus-feature/features.md`** — append inventory entry.
6. **`examples/src/phaser-plus/scenes/<Name>.js`** — runnable Phaser Scene exercising the feature. Mirror existing scenes (`ScreenShakeDemo.js`, `PathFinderDemo.js`, `BehaviorTreeDemo.js`). Required.
7. **`examples/src/phaser-plus/index.tsx`** — register: `import <Name> from './scenes/<Name>.js'` then append to `phaserExamples`: `{ key: '<kebab>', title: '<Title>', category: '<MatchingPhaserCategory>', description: '<one line>', sceneFile: '<Name>.js', element: <PhaserCanvas sceneClass={<Name>} /> }`. Pick the closest existing `PhaserCategory` or extend the union.

## Templates

### Subclass `Feature`

```ts
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

class MyFeature extends Feature {

    private state: number = 0

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    override onCreate(): void {
        this.state = 0
    }

    override onUpdate(_time: number, delta: number): void {
        this.state += delta
    }

    override onDestroy(): void {
        this.state = 0
    }

}

export default MyFeature
```

Register from a scene:

```ts
this.features.register('my', MyFeature)
```

### Subclass `Layer` (camera + container)

```ts
import Layer from '../features/Layer'

class MyLayer extends Layer {

    override onCreate(): void {
        super.onCreate()
        this.setBackgroundColor('#000')
    }

}

export default MyLayer
```

### Subclass `FlowProcessor`

```ts
import FlowProcessor from './FlowProcessor'

class MyProcessor extends FlowProcessor {

    static readonly EVENT_TYPE = 'my_processor'

    private items: Map<string, MyEntry> = new Map()

    add(id: string, entry: MyEntry): void {
        this.items.set(id, entry)
    }

    override onUpdate(_time: number, delta: number): void {
        for (const item of this.items.values()) {
            item.tick(delta)
        }
    }

    override onDestroy(): void {
        this.items.clear()
    }

}

export default MyProcessor
```

Register via `scene.flow.addProcessor(MyProcessor.EVENT_TYPE, MyProcessor)`.

### Subclass `Effect` (shader)

```ts
import Effect from './Effect'

class MyEffect extends Effect {

    static readonly KEY = 'my-effect'

    static readonly FRAGMENT = `precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float uIntensity;
        varying vec2 outTexCoord;
        void main() {
            vec4 color = texture2D(uMainSampler, outTexCoord);
            gl_FragColor = vec4(color.rgb * uIntensity, color.a);
        }`

    intensity: number = 1

    applyUniforms(programManager: any, _time: number): void {
        programManager.setUniform('uIntensity', this.intensity)
    }

}

export default MyEffect
```

Register via `installEffects(game)` (alongside built-ins) or rely on `EffectManager.add(MyEffect)` — the manager lazily registers the RenderNode on first use. (`ensureEffectRegistered` exists in source but is internal; not exported from `effects/index.ts`.)

### Subclass `Panel` (debugger)

```ts
import Panel from './Panel'

class MyPanel extends Panel {

    override draw(): void {
        this.base.addBinding(this.scene.player, 'hp', { readonly: true, label: 'HP' })
        this.base.addButton({ title: 'Reset' }).on('click', () => this.scene.reset())
    }

    override doUpdate(): void {
        // tweakpane refresh
    }

}

export default MyPanel
```

Register via `dbg.addPanel('my', MyPanel, 'My Panel')`.

### Subclass `NavMesh`

```ts
import NavMesh from './NavMesh'

class TileMesh extends NavMesh {

    constructor(private map: Phaser.Tilemaps.Tilemap) {
        super()
    }

    isBlocked(x: number, y: number): boolean {
        const tile = this.map.getTileAt(x, y)
        return tile?.collides ?? true
    }

    cost(x: number, y: number): number {
        return this.map.getTileAt(x, y)?.properties.cost ?? 1
    }

}

export default TileMesh
```

## Workflow

1. **Read** `.claude/skills/phaser-plus-feature/features.md`, `conventions.md`, and `examples/public/phaser-plus/SKILL.md`.
2. **Decide** which existing base your feature subclasses. Confirm via REUSE checks above.
3. **Create** `phaser-plus/src/<group>/<Name>.ts` from the matching template.
4. **Wire** into `phaser-plus/src/<group>/index.ts` and (if new subsystem) `phaser-plus/src/index.ts`.
5. **Add tests** if behavior is testable without a Phaser instance (rare — most features need a running game).
6. **Append API section** to `examples/public/phaser-plus/SKILL.md`.
7. **Append inventory entry** to `.claude/skills/phaser-plus-feature/features.md`.
8. **Create demo scene** at `examples/src/phaser-plus/scenes/<Name>.js` and register in `examples/src/phaser-plus/index.tsx` (`phaserExamples` entry with `key`, `title`, `category`, `description`, `sceneFile`, `element: <PhaserCanvas sceneClass={<Name>} />`). Required.
9. **Verify** with `npm -w @toolcase/phaser-plus run typecheck` and `npm -w @toolcase/phaser-plus run build`.
10. **Verify demo** with `npm -w @toolcase/examples run dev` and load the scene route.

## Anti-patterns

- Overriding Phaser's own lifecycle hooks (`init`, `preload`, `create`, `update`). Use the engine hooks instead.
- Importing `@toolcase/logging` directly. Use `this.scene.engine.getLogger(...)`.
- Adding module-level singletons. Use `engine.services` for game-wide singletons.
- Bypassing `scene.pool` and manually managing GameObject lifecycle for hot objects.
- Bypassing `scene.features` and storing scene-lifetime modules on the scene class itself.
- Subclassing Phaser classes directly when a `Feature` would do.
- Throwing inside `onUpdate` without handling it (use `scene.engine.getLogger().error` then continue).
- Creating a sibling debugger / replay / cinema system instead of subclassing the existing one.
- Bypassing `this.emit(...)` to dispatch internal feature events (use it; consumers `features.on(...)`).
- Adding a CJS code path. ESM-only.
- Code comments.
- Trailing semicolons.
- Skipping the demo scene, the published SKILL.md update, or the inventory update.

# `@toolcase/phaser-plus` Code Conventions

Authoritative style + structure contract for files under `phaser-plus/src/`. Match what already exists — open `Engine.ts`, `Scene.ts`, `Feature.ts`, `Layer.ts`, `ObjectLayer.ts`, `FlowProcessor.ts`, `Effect.ts` and copy the shape.

---

## Indent & whitespace

- 4-space indent. No tabs.
- **No trailing semicolons.** Match existing files.
- One blank line between top-level statements.

---

## File layout

- One class per file. Filename matches export.
- `export default <Name>` at the end. Named re-export at the bottom for type aliases / event constants.
- Subsystem groups under `phaser-plus/src/<group>/` with their own `index.ts`. Established subsystems: `engine/`, `features/`, `pool/`, `flow/`, `effects/`, `debugger/`, `perspective2d/`, `cinema/`, `input/`, `ai/`, `math/`.

---

## Build constraint

- **ESM-only.** `phaser-plus/package.json` declares `"type": "module"` with one ESM `import` export.
- No CJS wrappers. No conditional `require()`.
- `npm -w @toolcase/phaser-plus run build` runs `tsc -p tsconfig.build.json`.

---

## Imports

- `phaser` is a peer; use `import type { Cameras, GameObjects, Input } from 'phaser'` for types and `import { ... } from 'phaser'` only when actually instantiating Phaser globals.
- `@toolcase/base` and `@toolcase/logging` are peers. Importing from them is allowed but rare — prefer the engine's wrappers.
- Relative imports inside `phaser-plus/src/`: no extension.
- Type-only imports: `import type Scene from '../engine/Scene'` when you only need the type.

---

## TypeScript style

- Strict mode on. No implicit `any`.
- Public absence is `null` (matches `Layer.getByName<T>()`).
- `Feature` constructor signature is fixed: `(scene: Scene, key: string)`. Always call `super(scene, key)`.
- Override Phaser/engine hooks with `override` keyword.

---

## Lifecycle hooks

Engine hooks (override on subclass):

| Class | Hooks |
|---|---|
| `Scene` | `beforeInit`, `onInit`, `onLoad`, `onCreate`, `onUpdate(time, delta)`, `onDestroy` |
| `Feature` | `onCreate`, `onUpdate(time, delta)`, `preDestroy`, `onDestroy` |
| `GameObject` | `onCreate`, `onAdd(parent)`, `onUpdate(time, delta)`, `onRemove`, `onDestroy` |
| `FlowProcessor` | `onCreate`, `onUpdate(time, delta)`, `onDestroy` |
| `Panel` | `draw()`, `doUpdate()`, `dispose()` |
| `Effect` | `applyUniforms(programManager, time)` |
| `Path` (subclass-internal) | n/a — listen for `PATH_FOUND`/`PATH_FAILED` |

**Never override** Phaser's own `init`, `preload`, `create`, `update`. The engine drives them.

`onUpdate` parameters: `(time: number, delta: number)`. Use the underscore-prefix convention for unused params: `onUpdate(_time, delta)`.

---

## Logger

Always use `this.scene.engine.getLogger('<scope>')` inside features. Don't `import` from `@toolcase/logging` directly inside `phaser-plus/src/`.

```ts
class MyFeature extends Feature {
    private log = this.scene.engine.getLogger(`my-feature=${this.key}`)

    override onCreate(): void {
        this.log.debug('created')
    }
}
```

---

## Broadcast events

Features dispatch via `this.emit(name, ...args)`. Consumers listen via `scene.features.on(name, fn)`.

Event constants live next to the feature that emits them, exported as named exports:

```ts
export const SHOT_DONE = 'camera_director.shot_done'

class CameraDirector extends Feature {
    override onUpdate(): void {
        if (done) this.emit(SHOT_DONE, shot)
    }
}
```

---

## Class shape

```ts
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export const MY_EVENT = 'my_feature.something'

class MyFeature extends Feature {

    private state: SomeState | null = null

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    override onCreate(): void {
        this.state = new SomeState()
    }

    override onUpdate(_time: number, delta: number): void {
        if (this.state === null) return
        this.state.tick(delta)
        if (this.state.done) {
            this.emit(MY_EVENT, this.state.result)
        }
    }

    override onDestroy(): void {
        this.state = null
    }

}

export default MyFeature
```

---

## `Layer` extensions

Always call `super.onCreate()` before adding children. Set background after calling super.

```ts
class MyLayer extends Layer {

    override onCreate(): void {
        super.onCreate()
        this.setBackgroundColor('#0f172a')
    }

    override onDestroy(): void {
        super.onDestroy()
    }

}
```

For `ObjectLayer` subclasses, register pool keys in your scene's `onInit`, then `layer.add('key', x, y)` in `onCreate`.

---

## `FlowProcessor` extensions

```ts
import FlowProcessor from './FlowProcessor'

class MyProcessor extends FlowProcessor {

    static readonly EVENT_TYPE = 'my_processor'

    private items: Map<string, MyEntry> = new Map()

    add(id: string, entry: MyEntry): void {
        if (this.items.has(id)) {
            throw new Error(`id=${id} already registered`)
        }
        this.items.set(id, entry)
    }

    remove(id: string): boolean {
        return this.items.delete(id)
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

Register from a scene: `scene.flow.addProcessor(MyProcessor.EVENT_TYPE, MyProcessor)`.

---

## `Effect` extensions

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

Register alongside built-ins via `installEffects(game)`, or skip the registration step and let `EffectManager.add(MyEffect)` lazy-register on first use (`ensureEffectRegistered` is internal; not exported from `effects/index.ts`).

---

## Errors

- Plain `Error` only.
- Constructor / `add()` / `register()` validation: throw on duplicate keys, missing required input.
- Inside `onUpdate`: catch + log via `this.scene.engine.getLogger(...).error(err)`. Don't let one tick failure tear down the whole scene.

---

## No comments

Match existing files. No `//`, no `/* */`, no JSDoc unless types alone are insufficient.

---

## Service singletons

Game-lifetime singletons go through `engine.services` — never module-level state.

```ts
engine.services.bind(MyService, () => new MyService())
const svc = engine.services.resolve(MyService)
```

---

## Pool

`scene.pool.register('bullet', Bullet)` once in `onInit`. `scene.pool.obtain<Bullet>('bullet')` to spawn. `(bullet as any).release()` (auto-attached) to return.

Never `new Bullet()` then `bullet.destroy()` for hot objects — the pool is the contract.

---

## Tests

`phaser-plus/test/<group>/<Name>.test.ts` — vitest. Most features need a running Phaser game (DOM + WebGL); for those, ship a `examples/src/phaser-plus/<Name>Demo.tsx` instead and verify visually.

For pure-data features (math helpers, processors that operate on plain inputs), write tests as usual.

---

## Build + verify

```bash
npm -w @toolcase/phaser-plus run typecheck     # tsc --noEmit
npm -w @toolcase/phaser-plus run build         # tsc -p tsconfig.build.json
```

Plus optional demo run:
```bash
npm -w @toolcase/examples run dev              # vite dev server
```

`examples/vite.config.ts` aliases `@toolcase/phaser-plus` directly to its `src/index.ts` — your changes show up live without rebuilding.

---

## Style anti-patterns

- Overriding Phaser's `init`, `preload`, `create`, `update` directly on a `Scene` subclass.
- Importing `@toolcase/logging` inside `phaser-plus/src/` (use `engine.getLogger(...)`).
- Module-level singletons or globals (use `engine.services`).
- `new Bullet()` + `destroy()` for hot objects (use `scene.pool`).
- Adding a sibling debugger / FSM / behavior-tree / cinema system instead of subclassing the existing one.
- Importing from `phaser` synchronously when only the type is needed (`import type` instead).
- Adding CJS code paths.
- Throwing inside `onUpdate` without catching.
- Calling `scene.events.emit` for feature-internal signals (use `this.emit`).
- Forgetting `super.onCreate()` / `super.onDestroy()` in `Layer` subclasses.
- Code comments.
- Trailing semicolons.
- 2-space indent.

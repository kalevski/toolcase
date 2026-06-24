import type GameObject from './GameObject'

/**
 * Base class for components attached to a `GameObject` via `addComponent()`.
 * Subclass this to define reusable, composable behaviors. The owning object
 * is available via `this.owner` after construction.
 *
 * Lifecycle (mirrors the owner's lifecycle):
 * - `onCreate()` — called once when the owner is first obtained from the pool
 *   (or immediately when `addComponent()` is called on a live object).
 * - `onUpdate(time, delta)` — called every frame as part of `doUpdate()`.
 * - `onDestroy()` — called when `removeComponent()` is invoked, or when the
 *   owner is destroyed.
 */
export default abstract class GameObjectComponent {
    owner!: GameObject

    onCreate(): void {}

    onUpdate(_time: number, _delta: number): void {}

    onDestroy(): void {}
}

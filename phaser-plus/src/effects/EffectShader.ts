import type Effect from './Effect'

type BaseFilterShaderCtor = new (
    name: string,
    manager: unknown,
    fragmentShaderKey: string | null,
    fragmentShaderSource: string
) => any

/**
 * Build a RenderNode class that subclasses Phaser's `BaseFilterShader`
 * (resolved at install-time so the renderer is initialized) and overrides
 * `setupUniforms` to bridge into the Effect controller.
 */
export function buildShaderNodeClass(
    BaseFilterShader: BaseFilterShaderCtor,
    key: string,
    fragment: string
): new (manager: unknown) => any {
    return class extends (BaseFilterShader as any) {
        constructor(manager: unknown) {
            super(key, manager, null, fragment)
        }
        setupUniforms(controller: Effect, _drawingContext: unknown): void {
            const t = performance.now() * 0.001
            controller.time = t
            controller.applyUniforms((this as any).programManager, t)
        }
    } as any
}

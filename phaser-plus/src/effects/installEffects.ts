import * as Phaser from 'phaser'
import type { Game } from 'phaser'
import { buildShaderNodeClass } from './EffectShader'
import type Effect from './Effect'
import { EFFECT_REGISTRY } from './registry'

type EffectClass = (new (...args: any[]) => Effect) & { KEY: string, FRAGMENT: string }

function resolveBaseFilterShader(): unknown {
    const direct = (Phaser as any)?.Renderer?.WebGL?.RenderNodes?.BaseFilterShader
    if (direct) return direct
    const Ph = (window as any).Phaser ?? (globalThis as any).Phaser
    return Ph?.Renderer?.WebGL?.RenderNodes?.BaseFilterShader
}

/**
 * Resolve the active RenderNodeManager. Phaser 4 exposes it as
 * `renderer.renderNodes` (the type definitions claim `renderNodeManager`
 * but the runtime field is `renderNodes`).
 */
function getNodeManager(game: Game): any {
    const renderer = (game as any).renderer
    return renderer?.renderNodes ?? renderer?.renderNodeManager ?? null
}

const registeredKeys = new WeakMap<object, Set<string>>()

/**
 * Lazily ensure a single effect class is registered with the game's
 * RenderNodeManager. Called by EffectManager on every `add()` so the demo
 * works even if the host forgot `installEffects(game)`.
 */
export function ensureEffectRegistered(game: Game, EffectClass: EffectClass): boolean {
    const manager = getNodeManager(game)
    if (!manager || typeof manager.addNodeConstructor !== 'function') return false

    let known = registeredKeys.get(manager)
    if (!known) {
        known = new Set()
        registeredKeys.set(manager, known)
    }
    if (known.has(EffectClass.KEY) || (typeof manager.hasNode === 'function' && manager.hasNode(EffectClass.KEY))) {
        known.add(EffectClass.KEY)
        return true
    }

    const BaseFilterShader = resolveBaseFilterShader()
    if (!BaseFilterShader) return false

    const NodeClass = buildShaderNodeClass(BaseFilterShader as any, EffectClass.KEY, EffectClass.FRAGMENT)
    manager.addNodeConstructor(EffectClass.KEY, NodeClass)
    known.add(EffectClass.KEY)
    return true
}

function tryInstall(game: Game): boolean {
    const manager = getNodeManager(game)
    if (!manager || typeof manager.addNodeConstructor !== 'function') return false

    const BaseFilterShader = resolveBaseFilterShader()
    if (!BaseFilterShader) {
        throw new Error('reef: Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader not found')
    }

    let known = registeredKeys.get(manager)
    if (!known) {
        known = new Set()
        registeredKeys.set(manager, known)
    }

    for (const E of EFFECT_REGISTRY as EffectClass[]) {
        if (known.has(E.KEY)) continue
        manager.addNodeConstructor(E.KEY, buildShaderNodeClass(BaseFilterShader as any, E.KEY, E.FRAGMENT))
        known.add(E.KEY)
    }
    return true
}

/**
 * Register every reef effect's RenderNode with the game's renderer.
 *
 * Safe to call immediately after `new Phaser.Game(config)`: if the renderer
 * has not booted yet, install defers to the game's `ready` event. Canvas /
 * unsupported environments silently skip.
 */
export function installEffects(game: Game): void {
    if (tryInstall(game)) return
    const events = (game as any).events
    if (events?.once) {
        events.once('ready', () => { tryInstall(game) })
    }
}

import Feature from '../features/Feature'
import EffectManager from '../effects/EffectManager'
import type Effect from '../effects/Effect'
import type Scene from '../engine/Scene'

type EffectCls = (new (camera: any) => Effect) & { KEY: string; FRAGMENT: string }

export interface ParticlePreset {
    texture: string
    frame?: string | number
    lifespan?: number
    quantity?: number
    speed?: { min: number; max: number } | number
    scale?: { start: number; end: number } | number
    alpha?: { start: number; end: number } | number
    tint?: number | number[]
    angle?: { min: number; max: number }
    gravityX?: number
    gravityY?: number
    blendMode?: number
    effect?: EffectCls
    effectDuration?: number
}

export interface StreamHandle {
    stop(): void
    readonly active: boolean
}

export const PARTICLE_BURST = 'particle_feature.burst'
export const PARTICLE_STREAM_START = 'particle_feature.stream_start'
export const PARTICLE_STREAM_STOP = 'particle_feature.stream_stop'

interface PresetEntry {
    preset: ParticlePreset
    free: any[]
}

interface ActiveEffect {
    instance: Effect
    elapsed: number
    duration: number
}

class StreamHandleImpl implements StreamHandle {

    active: boolean = true

    private emitterRef: any
    private stopCb: () => void

    constructor(emitterRef: any, stopCb: () => void) {
        this.emitterRef = emitterRef
        this.stopCb = stopCb
    }

    stop(): void {
        if (!this.active) return
        this.active = false
        const e = this.emitterRef
        if (e !== null) {
            if (typeof e.stopFollow === 'function') e.stopFollow()
            if (typeof e.stop === 'function') e.stop()
            else e.emitting = false
        }
        this.stopCb()
    }

}

class ParticleFeature extends Feature {

    private presets: Map<string, PresetEntry> = new Map()

    private effectMgr: EffectManager | null = null

    private activeEffects: Map<string, ActiveEffect> = new Map()

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setEffectTarget(target: any): this {
        this.effectMgr = new EffectManager(target)
        return this
    }

    define(name: string, preset: ParticlePreset): this {
        if (this.presets.has(name)) {
            throw new Error(`particle-feature: preset "${name}" already defined`)
        }
        this.presets.set(name, { preset, free: [] })
        return this
    }

    burst(name: string, x: number, y: number): void {
        const entry = this.presets.get(name)
        if (entry === undefined) {
            this.logger.warning(`burst: preset "${name}" not defined`)
            return
        }
        const { preset } = entry
        const lifespan = preset.lifespan ?? 800
        const quantity = preset.quantity ?? 20

        const emitter = this.obtainEmitter(entry, preset)
        this.placeEmitter(emitter, x, y)

        if (typeof emitter.explode === 'function') {
            emitter.explode(quantity)
        }

        this.scene.time.delayedCall(lifespan + 200, () => {
            entry.free.push(emitter)
        })

        this.emit(PARTICLE_BURST, name, x, y)

        if (preset.effect !== undefined && this.effectMgr !== null) {
            this.activateEffect(name, preset)
        }
    }

    stream(name: string, follow: any): StreamHandle {
        const entry = this.presets.get(name)
        if (entry === undefined) {
            this.logger.warning(`stream: preset "${name}" not defined`)
            const dead = new StreamHandleImpl(null, () => {})
            dead.stop()
            return dead
        }
        const { preset } = entry
        const emitter = this.obtainEmitter(entry, preset)

        if (typeof emitter.start === 'function') {
            emitter.start()
        } else {
            emitter.emitting = true
        }

        if (typeof emitter.startFollow === 'function') {
            emitter.startFollow(follow)
        } else {
            this.placeEmitter(emitter, follow.x ?? 0, follow.y ?? 0)
        }

        this.emit(PARTICLE_STREAM_START, name)

        if (preset.effect !== undefined && this.effectMgr !== null) {
            this.activateEffect(name, preset)
        }

        return new StreamHandleImpl(emitter, () => {
            entry.free.push(emitter)
            this.emit(PARTICLE_STREAM_STOP, name)
        })
    }

    override onCreate(): void {
        this.suppressWarning(PARTICLE_BURST, PARTICLE_STREAM_START, PARTICLE_STREAM_STOP)
    }

    override onUpdate(_time: number, delta: number): void {
        const toRemove: string[] = []
        for (const [name, ae] of this.activeEffects) {
            ae.elapsed += delta
            if (ae.elapsed >= ae.duration) {
                if (this.effectMgr !== null) {
                    this.effectMgr.remove(ae.instance)
                }
                toRemove.push(name)
            }
        }
        for (const name of toRemove) {
            this.activeEffects.delete(name)
        }
    }

    override onDestroy(): void {
        for (const ae of this.activeEffects.values()) {
            if (this.effectMgr !== null) {
                this.effectMgr.remove(ae.instance)
            }
        }
        for (const entry of this.presets.values()) {
            for (const e of entry.free) {
                if (typeof e.destroy === 'function') e.destroy()
            }
        }
        this.presets.clear()
        this.activeEffects.clear()
        this.effectMgr = null
    }

    private obtainEmitter(entry: PresetEntry, preset: ParticlePreset): any {
        return entry.free.length > 0 ? entry.free.pop() : this.createEmitter(preset)
    }

    private placeEmitter(emitter: any, x: number, y: number): void {
        if (typeof emitter.setPosition === 'function') {
            emitter.setPosition(x, y)
        } else {
            emitter.x = x
            emitter.y = y
        }
    }

    private createEmitter(preset: ParticlePreset): any {
        const cfg: Record<string, any> = {
            lifespan: preset.lifespan ?? 800,
            quantity: preset.quantity ?? 20,
            emitting: false
        }
        if (preset.speed !== undefined) cfg.speed = preset.speed
        if (preset.scale !== undefined) cfg.scale = preset.scale
        if (preset.alpha !== undefined) cfg.alpha = preset.alpha
        if (preset.tint !== undefined) cfg.tint = preset.tint
        if (preset.angle !== undefined) cfg.angle = preset.angle
        if (preset.gravityX !== undefined) cfg.gravityX = preset.gravityX
        if (preset.gravityY !== undefined) cfg.gravityY = preset.gravityY
        if (preset.blendMode !== undefined) cfg.blendMode = preset.blendMode
        if (preset.frame !== undefined) cfg.frame = preset.frame

        return (this.scene as any).add.particles(0, 0, preset.texture, cfg)
    }

    private activateEffect(name: string, preset: ParticlePreset): void {
        const prev = this.activeEffects.get(name)
        if (prev !== undefined) {
            this.effectMgr!.remove(prev.instance)
        }
        const duration = preset.effectDuration ?? (preset.lifespan ?? 800) * 1.5
        const instance = this.effectMgr!.add(preset.effect as any)
        this.activeEffects.set(name, { instance, elapsed: 0, duration })
    }

}

export default ParticleFeature

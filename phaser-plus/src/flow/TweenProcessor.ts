import FlowProcessor from './FlowProcessor'
import type Scene from '../engine/Scene'
import { resolveEase } from './easing'
import type { EaseFn } from './easing'

export interface TweenOptions {
    ms: number
    ease?: EaseFn | string
    delay?: number
    loop?: boolean | number
    yoyo?: boolean
    onComplete?: () => void
    onUpdate?: (progress: number, target: object) => void
}

export interface TweenHandle {
    cancel(): void
    pause(): void
    resume(): void
    readonly completed: boolean
    readonly cancelled: boolean
    readonly paused: boolean
    readonly progress: number
}

export interface TimelineHandle {
    cancel(): void
    pause(): void
    resume(): void
    seek(ms: number): void
    restart(): void
    readonly completed: boolean
    readonly cancelled: boolean
    readonly paused: boolean
    readonly elapsed: number
    readonly total: number
    readonly progress: number
}

export type TimelineStep =
    | { readonly kind: 'tween'; target: object; to: Record<string, number>; opts: TweenOptions; startAt: number }
    | { readonly kind: 'wait'; startAt: number; duration: number }
    | { readonly kind: 'call'; startAt: number; fn: () => void }

interface ActiveTween {
    target: Record<string, number>
    starts: Record<string, number>
    ends: Record<string, number>
    elapsed: number
    delay: number
    duration: number
    ease: EaseFn
    loop: number
    yoyo: boolean
    forward: boolean
    paused: boolean
    completed: boolean
    cancelled: boolean
    onComplete: (() => void) | null
    onUpdate: ((t: number, target: object) => void) | null
}

interface ActiveTimeline {
    steps: readonly TimelineStep[]
    initialValues: Map<TimelineStep, Record<string, number>>
    fired: Set<TimelineStep>
    elapsed: number
    total: number
    paused: boolean
    completed: boolean
    cancelled: boolean
    onComplete: (() => void) | null
}

export default class TweenProcessor extends FlowProcessor {

    static readonly EVENT_TYPE = 'tween'

    onLog: ((time: number, type: string, name: string) => void) | null = null

    private _tweens: ActiveTween[] = []
    private _timelines: ActiveTimeline[] = []

    constructor(scene: Scene, eventType: string) {
        super(scene, eventType)
    }

    tween(target: object, to: Record<string, number>, opts: TweenOptions): TweenHandle {
        const t = target as Record<string, number>
        const starts: Record<string, number> = {}
        for (const k of Object.keys(to)) {
            starts[k] = typeof t[k] === 'number' ? t[k] : 0
        }
        const loop = opts.loop === true ? -1 : (typeof opts.loop === 'number' ? opts.loop : 0)
        const state: ActiveTween = {
            target: t,
            starts,
            ends: { ...to },
            elapsed: 0,
            delay: opts.delay ?? 0,
            duration: opts.ms,
            ease: resolveEase(opts.ease),
            loop,
            yoyo: opts.yoyo ?? false,
            forward: true,
            paused: false,
            completed: false,
            cancelled: false,
            onComplete: opts.onComplete ?? null,
            onUpdate: opts.onUpdate ?? null
        }
        this._tweens.push(state)
        this._log('tween:start', Object.keys(to).join(','))
        return {
            cancel: () => { state.cancelled = true },
            pause: () => { state.paused = true },
            resume: () => { state.paused = false },
            get completed() { return state.completed },
            get cancelled() { return state.cancelled },
            get paused() { return state.paused },
            get progress() {
                if (state.duration <= 0) return 1
                return Math.min(1, Math.max(0, state.elapsed / state.duration))
            }
        }
    }

    _addTimeline(steps: readonly TimelineStep[], total: number, onComplete: (() => void) | null): TimelineHandle {
        const initialValues = new Map<TimelineStep, Record<string, number>>()
        for (const step of steps) {
            if (step.kind === 'tween') {
                const tgt = step.target as Record<string, number>
                const iv: Record<string, number> = {}
                for (const k of Object.keys(step.to)) {
                    iv[k] = typeof tgt[k] === 'number' ? tgt[k] : 0
                }
                initialValues.set(step, iv)
            }
        }

        const inst: ActiveTimeline = {
            steps,
            initialValues,
            fired: new Set(),
            elapsed: 0,
            total,
            paused: false,
            completed: false,
            cancelled: false,
            onComplete
        }

        this._timelines.push(inst)
        this._log('timeline:start', `${steps.length}steps`)

        // eslint-disable-next-line @typescript-eslint/no-this-alias -- handle methods need the processor instance
        const self = this
        const handle: TimelineHandle = {
            cancel() { inst.cancelled = true },
            pause() { inst.paused = true },
            resume() { inst.paused = false },
            seek(ms: number) { self._seekTimeline(inst, ms) },
            restart() {
                inst.cancelled = false
                inst.completed = false
                inst.fired.clear()
                inst.elapsed = 0
                if (!self._timelines.includes(inst)) {
                    self._timelines.push(inst)
                }
                self._log('timeline:start', `${inst.steps.length}steps`)
            },
            get completed() { return inst.completed },
            get cancelled() { return inst.cancelled },
            get paused() { return inst.paused },
            get elapsed() { return inst.elapsed },
            get total() { return inst.total },
            get progress() { return inst.total > 0 ? Math.min(1, inst.elapsed / inst.total) : 1 }
        }

        return handle
    }

    cancelAll(): void {
        for (const t of this._tweens) t.cancelled = true
        for (const tl of this._timelines) tl.cancelled = true
    }

    pauseAll(): void {
        for (const t of this._tweens) t.paused = true
        for (const tl of this._timelines) tl.paused = true
    }

    resumeAll(): void {
        for (const t of this._tweens) t.paused = false
        for (const tl of this._timelines) tl.paused = false
    }

    override onUpdate(_time: number, delta: number): void {
        this._tickTweens(delta)
        this._tickTimelines(delta)
    }

    override onDestroy(): void {
        this._tweens.length = 0
        this._timelines.length = 0
        this.onLog = null
    }

    private _tickTweens(delta: number): void {
        for (const s of this._tweens) {
            if (s.cancelled || s.completed || s.paused) continue
            if (s.delay > 0) {
                s.delay -= delta
                if (s.delay > 0) continue
                s.elapsed = -s.delay
                s.delay = 0
            } else {
                s.elapsed += delta
            }
            this._advanceTween(s)
        }
        this._tweens = this._tweens.filter(s => !s.cancelled && !s.completed)
    }

    private _advanceTween(s: ActiveTween): void {
        const rawT = s.duration > 0 ? Math.min(1, s.elapsed / s.duration) : 1
        const dirT = s.forward ? rawT : 1 - rawT
        const progress = s.ease(dirT)
        for (const k of Object.keys(s.starts)) {
            s.target[k] = s.starts[k] + (s.ends[k] - s.starts[k]) * progress
        }
        s.onUpdate?.(dirT, s.target as object)
        if (rawT >= 1) {
            if (s.loop !== 0) {
                if (s.loop > 0) s.loop--
                s.elapsed = 0
                if (s.yoyo) s.forward = !s.forward
            } else {
                const finalDir = s.forward ? 1 : 0
                const finalProgress = s.ease(finalDir)
                for (const k of Object.keys(s.starts)) {
                    s.target[k] = s.starts[k] + (s.ends[k] - s.starts[k]) * finalProgress
                }
                s.completed = true
                s.onComplete?.()
                this._log('tween:complete', Object.keys(s.starts).join(','))
            }
        }
    }

    private _tickTimelines(delta: number): void {
        for (const inst of this._timelines) {
            if (inst.cancelled || inst.completed || inst.paused) continue
            inst.elapsed += delta
            if (inst.elapsed >= inst.total) {
                inst.elapsed = inst.total
                this._applyTimeline(inst, inst.elapsed)
                inst.completed = true
                inst.onComplete?.()
                this._log('timeline:complete', `${inst.steps.length}steps`)
            } else {
                this._applyTimeline(inst, inst.elapsed)
            }
        }
        this._timelines = this._timelines.filter(inst => !inst.cancelled && !inst.completed)
    }

    _seekTimeline(inst: ActiveTimeline, ms: number): void {
        const clamped = Math.min(inst.total, Math.max(0, ms))
        inst.elapsed = clamped
        if (clamped < inst.total) inst.completed = false
        inst.fired.clear()
        this._applyTimeline(inst, clamped)
    }

    _applyTimeline(inst: ActiveTimeline, elapsed: number): void {
        for (const step of inst.steps) {
            if (step.kind === 'tween') {
                if (elapsed < step.startAt) continue
                const iv = inst.initialValues.get(step)
                if (iv === undefined) continue
                const duration = step.opts.ms
                const t = duration > 0 ? Math.min(1, (elapsed - step.startAt) / duration) : 1
                const ease = resolveEase(step.opts.ease)
                const progress = ease(t)
                const tgt = step.target as Record<string, number>
                for (const k of Object.keys(step.to)) {
                    tgt[k] = iv[k] + (step.to[k] - iv[k]) * progress
                }
            } else if (step.kind === 'call') {
                if (elapsed >= step.startAt && !inst.fired.has(step)) {
                    inst.fired.add(step)
                    step.fn()
                }
            }
        }
    }

    private _log(type: string, name: string): void {
        if (this.onLog !== null) {
            this.onLog((this.scene.game as any).loop?.time ?? 0, type, name)
        }
    }

}

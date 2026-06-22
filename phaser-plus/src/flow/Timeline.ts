import type Scene from '../engine/Scene'
import type { TweenOptions, TimelineHandle, TimelineStep } from './TweenProcessor'

export interface ParallelBuilder {
    to(target: object, to: Record<string, number>, opts: TweenOptions): ParallelBuilder
    call(fn: () => void): ParallelBuilder
}

export default class Timeline {

    private _steps: TimelineStep[] = []
    private _cursor: number = 0
    private _scene: Scene

    constructor(scene: Scene) {
        this._scene = scene
    }

    to(target: object, to: Record<string, number>, opts: TweenOptions): this {
        const start = this._cursor + (opts.delay ?? 0)
        this._steps.push({ kind: 'tween', target, to, opts: { ...opts, delay: 0 }, startAt: start })
        this._cursor = start + opts.ms
        return this
    }

    parallel(callback: (sub: ParallelBuilder) => void): this {
        const base = this._cursor
        let max = 0
        const sub: ParallelBuilder = {
            to: (target: object, to: Record<string, number>, opts: TweenOptions): ParallelBuilder => {
                const dur = (opts.delay ?? 0) + opts.ms
                if (dur > max) max = dur
                this._steps.push({
                    kind: 'tween',
                    target,
                    to,
                    opts: { ...opts, delay: 0 },
                    startAt: base + (opts.delay ?? 0)
                })
                return sub
            },
            call: (fn: () => void): ParallelBuilder => {
                this._steps.push({ kind: 'call', startAt: base, fn })
                return sub
            }
        }
        callback(sub)
        this._cursor = base + max
        return this
    }

    stagger(targets: object[], to: Record<string, number>, opts: TweenOptions, staggerMs: number): this {
        const base = this._cursor
        for (let i = 0; i < targets.length; i++) {
            this._steps.push({
                kind: 'tween',
                target: targets[i],
                to,
                opts: { ...opts, delay: 0 },
                startAt: base + i * staggerMs
            })
        }
        if (targets.length > 0) {
            this._cursor = base + (targets.length - 1) * staggerMs + opts.ms
        }
        return this
    }

    wait(ms: number): this {
        this._steps.push({ kind: 'wait', startAt: this._cursor, duration: ms })
        this._cursor += ms
        return this
    }

    call(fn: () => void): this {
        this._steps.push({ kind: 'call', startAt: this._cursor, fn })
        return this
    }

    play(onComplete?: () => void): TimelineHandle {
        const processor = (this._scene.flow as any).tweens
        return (processor as { _addTimeline(s: readonly TimelineStep[], t: number, c: (() => void) | null): TimelineHandle })
            ._addTimeline(this._steps, this._cursor, onComplete ?? null)
    }

    get totalDuration(): number {
        return this._cursor
    }

}

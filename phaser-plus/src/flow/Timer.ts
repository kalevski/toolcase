import type Scene from '../engine/Scene'
import TimeEvent from './TimeEvent'

export interface TimerHandle {
    cancel(): void
    pause(): void
    resume(): void
    readonly cancelled: boolean
}

export interface SequenceStep {
    delay: number
    run(): void
}

let counter = 0

function makeId(prefix: string): string {
    return `__sugar_${prefix}_${++counter}`
}

export default class Timer {

    static delay(scene: Scene, sec: number, fn: () => void): TimerHandle {
        let cancelled = false
        scene.flow.events.triggerFn(() => {
            if (!cancelled) fn()
        }, Math.max(0, sec))
        return {
            cancel() { cancelled = true },
            pause() { cancelled = true },
            resume() { cancelled = false },
            get cancelled() { return cancelled }
        }
    }

    static interval(scene: Scene, sec: number, fn: (count: number) => void): TimerHandle {
        const id = makeId('interval')
        const handler = fn
        class IntervalEvent extends TimeEvent {
            override onFire(times: number): void {
                handler(times)
            }
        }
        scene.flow.timer.add(id, IntervalEvent, sec)
        let cancelled = false
        return {
            cancel() {
                if (cancelled) return
                cancelled = true
                scene.flow.timer.remove(id)
            },
            pause() {
                if (!cancelled) scene.flow.timer.pause(id)
            },
            resume() {
                if (!cancelled) scene.flow.timer.resume(id)
            },
            get cancelled() { return cancelled }
        }
    }

    static sequence(scene: Scene, steps: SequenceStep[]): TimerHandle {
        let cancelled = false
        let elapsed = 0
        for (const step of steps) {
            elapsed += Math.max(0, step.delay)
            const at = elapsed
            const run = step.run
            scene.flow.events.triggerFn(() => {
                if (!cancelled) run()
            }, at)
        }
        return {
            cancel() { cancelled = true },
            pause() { cancelled = true },
            resume() { cancelled = false },
            get cancelled() { return cancelled }
        }
    }

}

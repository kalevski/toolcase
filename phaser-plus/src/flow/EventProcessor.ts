import { ObjectPool } from '@toolcase/base'
import Event from './Event'
import FlowProcessor from './FlowProcessor'

const TIMEOUT_FN_NAME = '@toolcase/phaser-plus/timeoutFn'

type TimerCallback = (...args: unknown[]) => void

class TimerDef {
    event: Event<unknown> | TimerCallback | null = null
    name: string = ''
    time: number = 0
    payload: unknown = null
    context: unknown = null
}

type EventClass<E extends Event<P>, P> = new (scene: import('../engine/Scene').default) => E

export default class EventProcessor extends FlowProcessor {

    private readonly timerDefPool = new ObjectPool(TimerDef, (def: TimerDef) => {
        def.event = null
        def.name = ''
        def.time = 0
        def.payload = null
        def.context = null
    })

    private queue: TimerDef[] = []

    private readonly eventMap: Map<string, Event<unknown>> = new Map()

    get keys(): string[] {
        return Array.from(this.eventMap.keys())
    }

    onUpdate(time: number, delta: number): void {
        // Snapshot the current queue so that re-triggers during firing land in
        // this.queue and are deferred to the next frame instead of mutating the
        // active iteration.
        const snapshot = this.queue
        this.queue = []

        const remaining: TimerDef[] = []
        for (const def of snapshot) {
            def.time += delta / 1000
            if (def.time >= 0) {
                if (def.name === TIMEOUT_FN_NAME) {
                    (def.event as TimerCallback).call(def.context)
                } else {
                    (def.event as Event<unknown>).onFire(def.payload)
                }
                this.timerDefPool.release(def)
            } else {
                remaining.push(def)
            }
        }
        // Prepend still-waiting defs before any newly triggered (next-frame) defs.
        this.queue = [...remaining, ...this.queue]
    }

    onDestroy(): void {
        this.queue = []
        for (const key of Array.from(this.eventMap.keys())) {
            this.remove(key)
        }
    }

    add<P, E extends Event<P>>(eventName: string, eventClass: EventClass<E, P>): this {
        if (this.eventMap.has(eventName)) {
            throw new Error(`event with name=${eventName} is already registered`)
        }
        const event = new eventClass(this.scene)
        if (event.type !== this.eventType) {
            throw new Error(`provided event with type ${event.type}, ${this.eventType} is acceptable`)
        }
        this.eventMap.set(eventName, event as Event<unknown>)
        event.onCreate()
        return this
    }

    remove(eventName: string): this {
        const event = this.eventMap.get(eventName)
        if (event !== undefined) {
            event.onDestroy()
            this.eventMap.delete(eventName)
        }
        return this
    }

    off(eventName: string): this {
        return this.remove(eventName)
    }

    has(eventName: string): boolean {
        return this.eventMap.has(eventName)
    }

    replace<P, E extends Event<P>>(eventName: string, eventClass: EventClass<E, P>): this {
        this.remove(eventName)
        return this.add(eventName, eventClass)
    }

    trigger<P>(eventName: string, payload?: P, delay: number = 0): this {
        if (!this.eventMap.has(eventName)) {
            throw new Error(`event name=${eventName} is not registered`)
        }
        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`delay must be a non-negative number`)
        }
        const def = this.timerDefPool.obtain()
        def.name = eventName
        def.time = -delay
        def.event = this.eventMap.get(eventName) ?? null
        def.payload = payload ?? null
        this.queue.push(def)
        return this
    }

    triggerNow<P>(eventName: string, payload?: P): this {
        const event = this.eventMap.get(eventName) ?? null
        if (event === null) {
            throw new Error(`event name=${eventName} is not registered`)
        }
        event.onFire(payload)
        return this
    }

    triggerFn(callbackFn: () => void, delay: number = 0, context: unknown = null): this {
        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`delay must be a non-negative number`)
        }
        if (typeof callbackFn !== 'function') {
            throw new Error(`callbackFn must be a function`)
        }
        const def = this.timerDefPool.obtain()
        def.name = TIMEOUT_FN_NAME
        def.time = -delay
        def.event = callbackFn
        def.context = context
        this.queue.push(def)
        return this
    }

}

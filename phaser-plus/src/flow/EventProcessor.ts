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

    private readonly timerDefPool = new ObjectPool(TimerDef)

    private queue: TimerDef[] = []

    private readonly eventMap: Map<string, Event<unknown>> = new Map()

    get keys(): string[] {
        return Array.from(this.eventMap.keys())
    }

    onUpdate(time: number, delta: number): void {
        const indices: number[] = []
        for (let index = 0; index < this.queue.length; index++) {
            const def = this.queue[index]!
            def.time += delta / 1000
            if (def.time > 0) {
                if (def.name === TIMEOUT_FN_NAME) {
                    (def.event as TimerCallback).call(def.context)
                } else {
                    (def.event as Event<unknown>).onFire(def.payload)
                }
                indices.unshift(index)
            }
        }
        for (const index of indices) {
            const [removed] = this.queue.splice(index, 1)
            if (removed) this.timerDefPool.release(removed)
        }
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
            throw new Error(`delay must be a positive number`)
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
            throw new Error(`delay must be a positive number`)
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

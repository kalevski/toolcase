import FlowProcessor from './FlowProcessor'
import TimeEvent from './TimeEvent'

interface TimerDef {
    id: string
    event: TimeEvent
    current: number
    interval: number
    counter: number
    paused: boolean
}

type TimeEventClass<T extends TimeEvent> = new (scene: import('../Scene').default) => T

export default class TimeEventProcessor extends FlowProcessor {

    private readonly timers: TimerDef[] = []

    onUpdate(_time: number, delta: number): void {
        const dt = delta / 1000
        for (const timer of this.timers) {
            if (timer.paused) continue
            timer.current += dt
            while (timer.current > timer.interval) {
                timer.current -= timer.interval
                timer.counter++
                timer.event.onFire(timer.counter)
            }
        }
    }

    onDestroy(): void {
        const ids = this.timers.map(def => def.id)
        for (const id of ids) {
            this.remove(id)
        }
    }

    add<T extends TimeEvent>(id: string, timeEventClass: TimeEventClass<T>, interval: number = 1, delay: number = 0): T {
        if (typeof interval !== 'number' || interval <= 0) {
            throw new Error(`interval must be a number greater than 0`)
        }
        if (typeof delay !== 'number' || delay < 0) {
            throw new Error(`delay must be a positive number`)
        }
        const existing = this.timers.find(def => def.id === id) ?? null
        if (existing !== null) {
            throw new Error(`timer with id=${id} is already registered`)
        }
        const event = new timeEventClass(this.scene)
        if (event.type !== this.eventType) {
            throw new Error(`provided event with type ${event.type}, ${this.eventType} is acceptable`)
        }
        this.timers.push({
            id,
            current: -delay,
            interval,
            event,
            counter: 0,
            paused: false
        })
        event.onCreate()
        return event
    }

    remove(id: string): this {
        const index = this.timers.findIndex(def => def.id === id)
        if (index !== -1) {
            this.timers[index]!.event.onDestroy()
            this.timers.splice(index, 1)
        }
        return this
    }

    has(id: string): boolean {
        return this.timers.some(def => def.id === id)
    }

    get<T extends TimeEvent>(id: string): T | null {
        const def = this.timers.find(d => d.id === id)
        return def ? (def.event as T) : null
    }

    pause(id: string): this {
        const def = this.timers.find(d => d.id === id)
        if (def) def.paused = true
        return this
    }

    resume(id: string): this {
        const def = this.timers.find(d => d.id === id)
        if (def) def.paused = false
        return this
    }

    reset(id: string, delay: number = 0): this {
        const def = this.timers.find(d => d.id === id)
        if (def) {
            def.current = -delay
            def.counter = 0
        }
        return this
    }

}

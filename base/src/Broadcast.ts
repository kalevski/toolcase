import EventEmitter from './EventEmitter'

class Broadcast {

    private events: EventEmitter = new EventEmitter()

    on(event: string | symbol, fn: (...args: any[]) => void, context?: any): this {
        this.events.on(event, fn, context)
        return this
    }

    off(event: string | symbol, fn: (...args: any[]) => void, context?: any): this {
        this.events.off(event, fn, context)
        return this
    }

    once(event: string | symbol, fn: (...args: any[]) => void, context?: any): this {
        this.events.once(event, fn, context)
        return this
    }

    protected emit(event: string | symbol, ...messages: any[]): boolean {
        return this.events.emit(event, ...messages)
    }

    removeAllListeners(event?: string | symbol): this {
        this.events.removeAllListeners(event)
        return this
    }

    listenerCount(event: string | symbol): number {
        return this.events.listenerCount(event)
    }

    eventNames(): (string | symbol)[] {
        return this.events.eventNames()
    }

}

export default Broadcast

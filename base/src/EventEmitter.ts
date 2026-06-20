type EventListener = (...args: any[]) => void

interface ListenerEntry {
    fn: EventListener
    context: any
    once: boolean
}

class EventEmitter {
    private _listeners = new Map<string | symbol, ListenerEntry[]>()

    on(event: string | symbol, fn: EventListener, context?: any): this {
        const entries = this._listeners.get(event)
        const entry: ListenerEntry = { fn, context: context ?? this, once: false }
        if (entries) entries.push(entry)
        else this._listeners.set(event, [entry])
        return this
    }

    once(event: string | symbol, fn: EventListener, context?: any): this {
        const entries = this._listeners.get(event)
        const entry: ListenerEntry = { fn, context: context ?? this, once: true }
        if (entries) entries.push(entry)
        else this._listeners.set(event, [entry])
        return this
    }

    off(event: string | symbol, fn?: EventListener, context?: any): this {
        if (!fn) {
            this._listeners.delete(event)
            return this
        }
        const entries = this._listeners.get(event)
        if (!entries) return this
        const filtered = entries.filter(e =>
            e.fn !== fn || (context !== undefined && e.context !== context)
        )
        if (filtered.length) this._listeners.set(event, filtered)
        else this._listeners.delete(event)
        return this
    }

    emit(event: string | symbol, ...args: any[]): boolean {
        const entries = this._listeners.get(event)
        if (!entries || entries.length === 0) return false
        const snapshot = entries.slice()
        const survivors: ListenerEntry[] = []
        for (const entry of entries) {
            if (!entry.once) survivors.push(entry)
        }
        if (survivors.length === 0) {
            this._listeners.delete(event)
        } else if (survivors.length !== entries.length) {
            this._listeners.set(event, survivors)
        }
        for (const entry of snapshot) {
            entry.fn.apply(entry.context, args)
        }
        return true
    }

    removeAllListeners(event?: string | symbol): this {
        if (event !== undefined) this._listeners.delete(event)
        else this._listeners.clear()
        return this
    }

    listenerCount(event: string | symbol): number {
        return this._listeners.get(event)?.length ?? 0
    }

    eventNames(): (string | symbol)[] {
        return [...this._listeners.keys()]
    }
}

export default EventEmitter

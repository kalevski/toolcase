import Feature from '../features/Feature'

export interface BufferedInput {
    action: string
    time: number
    payload?: unknown
}

export default class InputBuffer extends Feature {

    private buffer: BufferedInput[] = []

    private capacity: number = 64

    private windowMs: number = 500

    setCapacity(value: number): this {
        if (value <= 0) throw new Error('capacity must be > 0')
        this.capacity = value
        if (this.buffer.length > value) {
            this.buffer = this.buffer.slice(-value)
        }
        return this
    }

    setWindow(ms: number): this {
        if (ms <= 0) throw new Error('window must be > 0')
        this.windowMs = ms
        return this
    }

    push(action: string, time: number = performance.now(), payload?: unknown): this {
        this.buffer.push({ action, time, payload })
        if (this.buffer.length > this.capacity) this.buffer.shift()
        return this
    }

    clear(): this {
        this.buffer = []
        return this
    }

    consume(action: string, withinMs: number = this.windowMs, now: number = performance.now()): BufferedInput | null {
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            const entry = this.buffer[i]!
            if (now - entry.time > withinMs) break
            if (entry.action === action) {
                this.buffer.splice(i, 1)
                return entry
            }
        }
        return null
    }

    peek(action: string, withinMs: number = this.windowMs, now: number = performance.now()): BufferedInput | null {
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            const entry = this.buffer[i]!
            if (now - entry.time > withinMs) break
            if (entry.action === action) return entry
        }
        return null
    }

    matches(sequence: string[], withinMs: number = this.windowMs, now: number = performance.now()): boolean {
        if (sequence.length === 0) return false
        let cursor = sequence.length - 1
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            const entry = this.buffer[i]!
            if (now - entry.time > withinMs) return false
            if (entry.action === sequence[cursor]) {
                cursor--
                if (cursor < 0) return true
            }
        }
        return false
    }

    consumeMatch(sequence: string[], withinMs: number = this.windowMs, now: number = performance.now()): boolean {
        if (sequence.length === 0) return false
        const indices: number[] = []
        let cursor = sequence.length - 1
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            const entry = this.buffer[i]!
            if (now - entry.time > withinMs) return false
            if (entry.action === sequence[cursor]) {
                indices.push(i)
                cursor--
                if (cursor < 0) {
                    for (const idx of indices) this.buffer.splice(idx, 1)
                    return true
                }
            }
        }
        return false
    }

    get entries(): readonly BufferedInput[] {
        return this.buffer
    }

    override onUpdate(_time: number, _delta: number): void {
        const now = performance.now()
        while (this.buffer.length > 0 && now - this.buffer[0]!.time > this.windowMs) {
            this.buffer.shift()
        }
    }

    override onDestroy(): void {
        this.buffer = []
    }

}

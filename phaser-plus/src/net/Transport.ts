/**
 * Minimal transport contract consumed by `NetFeature`.
 *
 * Implementations: `LoopbackTransport` (in-process, for tests + demos),
 * `WebSocketTransport` (native browser WebSocket).
 */
export interface Transport {
    readonly connected: boolean
    connect(): void
    disconnect(): void
    send(data: Uint8Array): void
    onMessage: ((data: Uint8Array) => void) | null
    onConnect: (() => void) | null
    onDisconnect: (() => void) | null
}

/**
 * In-process transport that links two endpoints in a matched pair.
 * Messages sent on one side are delivered to the other after `latencyMs`
 * (± `jitterMs`) using `setTimeout`.  Deterministic jitter requires the
 * caller to supply a seeded PRNG via the optional `rng` argument.
 *
 * ```ts
 * const [clientTransport, serverTransport] = LoopbackTransport.pair(50, 10)
 * ```
 */
export class LoopbackTransport implements Transport {

    static pair(
        latencyMs = 0,
        jitterMs = 0,
        rng: () => number = Math.random
    ): [LoopbackTransport, LoopbackTransport] {
        const a = new LoopbackTransport(latencyMs, jitterMs, rng)
        const b = new LoopbackTransport(latencyMs, jitterMs, rng)
        a._peer = b
        b._peer = a
        return [a, b]
    }

    private _connected = false
    private _peer: LoopbackTransport | null = null
    private readonly _latencyMs: number
    private readonly _jitterMs: number
    private readonly _rng: () => number
    private readonly _timers: Set<ReturnType<typeof setTimeout>> = new Set()

    onMessage: ((data: Uint8Array) => void) | null = null
    onConnect: (() => void) | null = null
    onDisconnect: (() => void) | null = null

    constructor(latencyMs = 0, jitterMs = 0, rng: () => number = Math.random) {
        this._latencyMs = latencyMs
        this._jitterMs = jitterMs
        this._rng = rng
    }

    get connected(): boolean {
        return this._connected
    }

    connect(): void {
        if (this._connected) return
        this._connected = true
        this.onConnect?.()
        if (this._peer !== null && !this._peer._connected) {
            this._peer._connected = true
            this._peer.onConnect?.()
        }
    }

    disconnect(): void {
        if (!this._connected) return
        this._connected = false
        this._clearTimers()
        this.onDisconnect?.()
        if (this._peer !== null && this._peer._connected) {
            this._peer._connected = false
            this._peer._clearTimers()
            this._peer.onDisconnect?.()
        }
    }

    send(data: Uint8Array): void {
        if (!this._connected || this._peer === null) return
        const jitter = this._jitterMs > 0 ? (this._rng() * 2 - 1) * this._jitterMs : 0
        const delay = Math.max(0, this._latencyMs + jitter)
        const copy = new Uint8Array(data)
        const peer = this._peer
        const id = setTimeout(() => {
            this._timers.delete(id)
            if (peer._connected) peer.onMessage?.(copy)
        }, delay)
        this._timers.add(id)
    }

    private _clearTimers(): void {
        for (const id of this._timers) clearTimeout(id)
        this._timers.clear()
    }
}

/**
 * Native browser `WebSocket` wrapper.
 *
 * ```ts
 * const transport = new WebSocketTransport('wss://example.com/game')
 * ```
 */
export class WebSocketTransport implements Transport {

    private _socket: WebSocket | null = null
    private readonly _url: string

    onMessage: ((data: Uint8Array) => void) | null = null
    onConnect: (() => void) | null = null
    onDisconnect: (() => void) | null = null

    private static readonly _enc = new TextEncoder()

    constructor(url: string) {
        this._url = url
    }

    get connected(): boolean {
        return this._socket !== null && this._socket.readyState === WebSocket.OPEN
    }

    connect(): void {
        if (this._socket !== null) return
        const socket = new WebSocket(this._url)
        socket.binaryType = 'arraybuffer'
        socket.onopen = () => this.onConnect?.()
        socket.onclose = () => {
            this._socket = null
            this.onDisconnect?.()
        }
        socket.onmessage = (event: MessageEvent) => {
            const raw: unknown = event.data
            const data = raw instanceof ArrayBuffer
                ? new Uint8Array(raw)
                : WebSocketTransport._enc.encode(String(raw))
            this.onMessage?.(data)
        }
        this._socket = socket
    }

    disconnect(): void {
        this._socket?.close()
        this._socket = null
    }

    send(data: Uint8Array): void {
        if (this.connected) this._socket!.send(data)
    }
}

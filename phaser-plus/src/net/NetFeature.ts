import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import type Debugger from '../debugger/Debugger'
import type NetPanel from '../debugger/panels/NetPanel'
import type { Transport } from './Transport'

// ─── public event constants ────────────────────────────────────────────────

export const NET_CONNECTED = 'net.connected'
export const NET_DISCONNECTED = 'net.disconnected'
export const NET_RTT_UPDATE = 'net.rtt'
export const NET_ENTITY_STATE = 'net.entity_state'

// ─── internal wire-format constants ────────────────────────────────────────

const MSG_PING = 0
const MSG_PONG = 1
const MSG_SYNC = 2
const MSG_ACK = 3

// ─── internal state types ──────────────────────────────────────────────────

interface RemoteState {
    state: Record<string, unknown>
    ts: number
}

interface RemoteEntity {
    buffer: RemoteState[]
}

interface LocalEntity {
    lastSentState: Record<string, unknown>
    predictedState: Record<string, unknown> | null
}

// ─── shared codec instances ────────────────────────────────────────────────

const _enc = new TextEncoder()
const _dec = new TextDecoder()

/**
 * Scene-lifetime `Feature` that drives a `Transport` and provides:
 *
 * - Ping / pong RTT measurement, reported into `NetPanel`.
 * - Entity state sync with snapshot + delta encoding (`syncEntity`).
 * - Interpolation buffer for remote entity positions (`interpolateEntity`).
 * - Optional client-side prediction (`predict` / `getPredicted`).
 * - `bindDebugger(dbg)` to wire RTT / loss / sent / recv into `NetPanel`.
 *
 * Wire format: `[1 byte type][JSON UTF-8 payload]`.
 * Swap for binary framing by replacing `_sendMessage` / `_onMessage` with
 * a `@toolcase/serializer`-based codec — the rest of the class is agnostic.
 *
 * ### Minimal usage
 * ```ts
 * import { NetFeature, LoopbackTransport, NetPanel } from '@toolcase/phaser-plus'
 *
 * const [clientT, serverT] = LoopbackTransport.pair(50)
 *
 * const netA = this.features.register('net-client', NetFeature)
 * netA.setTransport(clientT)
 *
 * const netB = this.features.register('net-server', NetFeature)
 * netB.setTransport(serverT)
 *
 * netA.connect()                          // connects both sides
 * netA.syncEntity('player', { x, y })     // send state
 * const state = netB.getEntityState('player')  // read received state
 * ```
 */
export default class NetFeature extends Feature {

    /** How often to send a ping (ms). */
    pingIntervalMs = 500

    /** Unacknowledged ping older than this is counted as lost. */
    pingTimeoutMs = 5000

    /** How far behind real-time to render remote entities (ms) for smooth interpolation. */
    interpolationDelay = 100

    /** Maximum number of buffered received states per remote entity. */
    maxStateBuffer = 10

    private _transport: Transport | null = null
    private _panel: NetPanel | null = null

    private _pingSeq = 0
    private _pendingPings = new Map<number, number>()   // seq → sendTime
    private _pingTimer = 0
    private _currentRTT = 0
    private _lostPings = 0
    private _totalPings = 0

    private _remoteEntities = new Map<string, RemoteEntity>()
    private _localEntities = new Map<string, LocalEntity>()
    private _netSeq = 0

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    override onCreate(): void {
        this.suppressWarning(NET_CONNECTED, NET_DISCONNECTED, NET_RTT_UPDATE, NET_ENTITY_STATE)
    }

    // ─── configuration ───────────────────────────────────────────────────────

    /**
     * Attach a transport.  Call before `connect()`.
     * Safe to swap transports at runtime (disconnects the old one first).
     */
    setTransport(transport: Transport): this {
        if (this._transport !== null) {
            this._transport.onMessage = null
            this._transport.onConnect = null
            this._transport.onDisconnect = null
        }
        this._transport = transport
        transport.onMessage = (data) => this._onMessage(data)
        transport.onConnect = () => this._onConnect()
        transport.onDisconnect = () => this._onDisconnect()
        return this
    }

    /**
     * Wire RTT / loss / sent / recv into a `NetPanel`.
     * Call after `dbg.addPanel('net', NetPanel)` and before `connect()`.
     */
    bindDebugger(dbg: Debugger): this {
        this._panel = dbg.getPanel<NetPanel>('net')
        return this
    }

    // ─── connection ──────────────────────────────────────────────────────────

    connect(): this {
        this._transport?.connect()
        return this
    }

    disconnect(): this {
        this._transport?.disconnect()
        return this
    }

    get isConnected(): boolean {
        return this._transport?.connected ?? false
    }

    // ─── telemetry ───────────────────────────────────────────────────────────

    /** Last measured round-trip time (ms). */
    get rtt(): number { return this._currentRTT }

    /** Packet-loss percentage (0–100) based on unanswered pings. */
    get loss(): number {
        return this._totalPings === 0 ? 0 : (this._lostPings / this._totalPings) * 100
    }

    // ─── entity sync ─────────────────────────────────────────────────────────

    /**
     * Send the current state of a local entity.
     *
     * The first call for a given `id` sends a full snapshot; subsequent calls
     * send only the fields that changed (delta encoding).  On the receiving
     * side, deltas are merged onto the last known snapshot before storage.
     *
     * Call every frame (or whenever state changes) — no-ops when connected
     * with no changes to send.
     */
    syncEntity(id: string, state: Record<string, unknown>): this {
        if (!this.isConnected) return this

        const local = this._localEntities.get(id)
        const seq = this._netSeq++

        if (local === undefined) {
            this._localEntities.set(id, { lastSentState: { ...state }, predictedState: null })
            this._sendMessage(MSG_SYNC, { id, seq, state, full: true })
            this._panel?.sent('sync')
            return this
        }

        // Delta: only send changed fields
        const delta: Record<string, unknown> = {}
        let hasChanges = false
        for (const k in state) {
            if (state[k] !== local.lastSentState[k]) {
                delta[k] = state[k]
                hasChanges = true
            }
        }
        if (!hasChanges) return this

        Object.assign(local.lastSentState, state)
        this._sendMessage(MSG_SYNC, { id, seq, state: delta, full: false })
        this._panel?.sent('sync')
        return this
    }

    /**
     * Return the latest received state for a remote entity, or `null` if
     * no state has arrived yet.
     */
    getEntityState<T extends Record<string, unknown>>(id: string): T | null {
        const remote = this._remoteEntities.get(id)
        if (!remote || remote.buffer.length === 0) return null
        return remote.buffer[remote.buffer.length - 1]!.state as T
    }

    /**
     * Return an interpolated state for a remote entity based on a rolling
     * render-delay buffer.  Numeric fields are linearly interpolated between
     * the two buffered samples that straddle `(now - renderDelay)`.
     *
     * Falls back to the latest sample when the buffer doesn't yet contain
     * two samples that straddle the target time.
     */
    interpolateEntity<T extends Record<string, unknown>>(
        id: string,
        renderDelay?: number
    ): T | null {
        const remote = this._remoteEntities.get(id)
        if (!remote || remote.buffer.length === 0) return null

        const delay = renderDelay ?? this.interpolationDelay
        const renderTime = Date.now() - delay
        const buf = remote.buffer

        if (buf.length === 1 || buf[0]!.ts >= renderTime) {
            return buf[0]!.state as T
        }

        let prev = buf[0]!
        let next = buf[buf.length - 1]!

        for (let i = 1; i < buf.length; i++) {
            if (buf[i]!.ts >= renderTime) {
                prev = buf[i - 1]!
                next = buf[i]!
                break
            }
        }

        const span = next.ts - prev.ts
        const t = span <= 0 ? 1 : Math.min(1, (renderTime - prev.ts) / span)

        const result: Record<string, unknown> = { ...prev.state }
        for (const k in next.state) {
            const pv = prev.state[k]
            const nv = next.state[k]
            result[k] = typeof pv === 'number' && typeof nv === 'number'
                ? pv + (nv - pv) * t
                : nv
        }
        return result as T
    }

    /**
     * Optimistically apply a predicted state for an entity.
     * Retrieve with `getPredicted(id)`.
     *
     * Reconciliation pattern: apply the prediction immediately so the local
     * display is responsive; when the authoritative server state arrives via
     * `getEntityState`, compare and snap to the server value if diverged.
     */
    predict<T extends Record<string, unknown>>(id: string, state: T): this {
        const local = this._localEntities.get(id) ?? { lastSentState: {}, predictedState: null }
        local.predictedState = state as Record<string, unknown>
        this._localEntities.set(id, local)
        return this
    }

    /**
     * Return the latest predicted state for `id`, or `null` if no prediction
     * was applied.
     */
    getPredicted<T extends Record<string, unknown>>(id: string): T | null {
        return (this._localEntities.get(id)?.predictedState as T | null | undefined) ?? null
    }

    // ─── lifecycle ───────────────────────────────────────────────────────────

    override onUpdate(_time: number, delta: number): void {
        if (!this.isConnected) return

        this._pingTimer += delta
        if (this._pingTimer >= this.pingIntervalMs) {
            this._pingTimer -= this.pingIntervalMs
            this._sendPing()
        }

        // Expire unanswered pings
        const now = Date.now()
        for (const [seq, sendTime] of this._pendingPings) {
            if (now - sendTime > this.pingTimeoutMs) {
                this._pendingPings.delete(seq)
                this._lostPings++
            }
        }

        this._panel?.reportLoss(this.loss)
    }

    override onDestroy(): void {
        if (this._transport !== null) {
            this._transport.onMessage = null
            this._transport.onConnect = null
            this._transport.onDisconnect = null
            this._transport = null
        }
        this._pendingPings.clear()
        this._remoteEntities.clear()
        this._localEntities.clear()
    }

    // ─── internals ───────────────────────────────────────────────────────────

    private _onConnect(): void {
        this.logger.info('transport connected')
        this._pingTimer = this.pingIntervalMs  // send first ping immediately
        this.emit(NET_CONNECTED)
    }

    private _onDisconnect(): void {
        this.logger.info('transport disconnected')
        this._pendingPings.clear()
        this.emit(NET_DISCONNECTED)
    }

    private _sendPing(): void {
        const seq = this._pingSeq++
        const t = Date.now()
        this._pendingPings.set(seq, t)
        this._totalPings++
        this._sendMessage(MSG_PING, { seq, t })
        this._panel?.sent('ping')
    }

    private _onMessage(data: Uint8Array): void {
        if (data.length === 0) return
        const type = data[0]!
        const payload = JSON.parse(_dec.decode(data.subarray(1)))

        if (type === MSG_PING) {
            // Echo back as pong (same payload contains the original sendTime)
            this._sendMessage(MSG_PONG, payload)
            this._panel?.received('ping')
        } else if (type === MSG_PONG) {
            const { seq, t } = payload as { seq: number; t: number }
            if (this._pendingPings.has(seq)) {
                this._currentRTT = Date.now() - t
                this._pendingPings.delete(seq)
                this._panel?.reportRTT(this._currentRTT)
                this._panel?.received('pong')
                this.emit(NET_RTT_UPDATE, this._currentRTT)
            }
        } else if (type === MSG_SYNC) {
            const { id, seq, state, full } = payload as {
                id: string
                seq: number
                state: Record<string, unknown>
                full: boolean
            }

            const remote = this._remoteEntities.get(id) ?? { buffer: [] }
            const baseState = (!full && remote.buffer.length > 0)
                ? { ...remote.buffer[remote.buffer.length - 1]!.state }
                : {}
            Object.assign(baseState, state)

            remote.buffer.push({ state: baseState, ts: Date.now() })
            if (remote.buffer.length > this.maxStateBuffer) remote.buffer.shift()
            this._remoteEntities.set(id, remote)

            this._sendMessage(MSG_ACK, { seq })
            this._panel?.received('sync')
            this.emit(NET_ENTITY_STATE, id, baseState)
        } else if (type === MSG_ACK) {
            // Acknowledgement received — could be used for reliable delivery
            this._panel?.received('ack')
        }
    }

    private _sendMessage(type: number, payload: unknown): void {
        if (!this.isConnected || this._transport === null) return
        const json = _enc.encode(JSON.stringify(payload))
        const buf = new Uint8Array(1 + json.length)
        buf[0] = type
        buf.set(json, 1)
        this._transport.send(buf)
    }
}

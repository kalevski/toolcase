import Panel from '../Panel'

interface NetState {
    rtt: number
    loss: number
    sentPerSec: number
    recvPerSec: number
    log: string
}

const MAX_LOG = 50

/**
 * Debugger panel for network telemetry.
 *
 * The reporting API (`reportRTT`, `reportLoss`, `sent`, `received`, `logMessage`)
 * is the intended bind surface for the future `NetFeature`. Until that subsystem
 * ships, callers push metrics manually — typically from a WebSocket message handler
 * or a ping loop. The panel contract is stable so that wiring in `NetFeature` later
 * only removes the manual calls, not any panel-side changes.
 */
export default class NetPanel extends Panel {

    state: NetState = {
        rtt: 0,
        loss: 0,
        sentPerSec: 0,
        recvPerSec: 0,
        log: ''
    }

    components: Record<string, any> = {}

    private messages: string[] = []

    private sentBucket = 0

    private recvBucket = 0

    private lastBucketTime = 0

    override draw(): void {
        this.components.rtt = this.base.addBinding(this.state, 'rtt', { readonly: true, view: 'graph', label: 'RTT ms', min: 0, max: 300 })
        this.components.loss = this.base.addBinding(this.state, 'loss', { readonly: true, label: 'Loss %' })
        this.components.sentPerSec = this.base.addBinding(this.state, 'sentPerSec', { readonly: true, label: 'Sent/s' })
        this.components.recvPerSec = this.base.addBinding(this.state, 'recvPerSec', { readonly: true, label: 'Recv/s' })
        this.components.log = this.base.addBinding(this.state, 'log', { readonly: true, label: 'Recent' })
        this.components.clear = this.base.addButton({ title: 'Clear log' }).on('click', () => this.clear())
    }

    /**
     * Push the current round-trip time.
     *
     * **Manual-instrumentation hook** — intended to be called by `NetFeature`
     * once it ships. Until then, call this yourself from a ping response handler.
     */
    reportRTT(ms: number): this {
        this.state.rtt = Math.round(ms)
        return this
    }

    /**
     * Push the current packet-loss percentage (0–100).
     *
     * **Manual-instrumentation hook** — intended to be called by `NetFeature`
     * once it ships.
     */
    reportLoss(pct: number): this {
        this.state.loss = Math.round(pct * 100) / 100
        return this
    }

    /**
     * Record one outbound message. Pass `label` to append a log entry.
     *
     * **Manual-instrumentation hook** — intended to be called by `NetFeature`
     * once it ships. Until then, call this yourself immediately after each
     * `socket.send()` (or equivalent).
     */
    sent(label: string = ''): this {
        this.sentBucket += 1
        if (label !== '') this.logMessage(`→ ${label}`)
        return this
    }

    /**
     * Record one inbound message. Pass `label` to append a log entry.
     *
     * **Manual-instrumentation hook** — intended to be called by `NetFeature`
     * once it ships. Until then, call this yourself from your socket `message`
     * event handler.
     */
    received(label: string = ''): this {
        this.recvBucket += 1
        if (label !== '') this.logMessage(`← ${label}`)
        return this
    }

    logMessage(msg: string): this {
        this.messages.push(msg)
        if (this.messages.length > MAX_LOG) this.messages.shift()
        return this
    }

    clear(): void {
        this.messages.length = 0
        this.state.log = ''
    }

    override doUpdate(): void {
        const now = Date.now()
        const elapsed = now - this.lastBucketTime
        if (elapsed >= 1000) {
            const ratio = elapsed / 1000
            this.state.sentPerSec = Math.round(this.sentBucket / ratio)
            this.state.recvPerSec = Math.round(this.recvBucket / ratio)
            this.sentBucket = 0
            this.recvBucket = 0
            this.lastBucketTime = now
        }
        this.state.log = this.messages.slice(-6).join(' | ')
        for (const key in this.components) this.components[key].refresh?.()
    }

}

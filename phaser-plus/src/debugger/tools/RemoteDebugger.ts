import Panel from '../Panel'

interface RemoteState {
    url: string
    status: 'closed' | 'connecting' | 'open' | 'error'
    snapshotMs: number
    sent: number
    received: number
}

export type RemoteCommand = (payload: unknown) => void

export type SnapshotProvider = () => Record<string, unknown>

export default class RemoteDebugger extends Panel {

    state: RemoteState = {
        url: 'ws://localhost:9099',
        status: 'closed',
        snapshotMs: 1000,
        sent: 0,
        received: 0
    }

    components: Record<string, any> = {}

    private socket: WebSocket | null = null

    private lastSnapshot = 0

    private snapshotProvider: SnapshotProvider | null = null

    private remoteHandlers: Record<string, RemoteCommand> = {}

    override draw(): void {
        this.components.url = this.base.addBinding(this.state, 'url', { label: 'WS URL' })
        this.components.snapshotMs = this.base.addBinding(this.state, 'snapshotMs', { label: 'Snap ms', min: 100, max: 10000, step: 100 })
        this.components.connect = this.base.addButton({ title: 'Connect' }).on('click', () => this.connect())
        this.components.disconnect = this.base.addButton({ title: 'Disconnect' }).on('click', () => this.disconnect())
        this.base.addBlade({ view: 'separator' })
        this.components.status = this.base.addBinding(this.state, 'status', { readonly: true, label: 'Status' })
        this.components.sent = this.base.addBinding(this.state, 'sent', { readonly: true, label: 'Sent' })
        this.components.received = this.base.addBinding(this.state, 'received', { readonly: true, label: 'Recv' })
    }

    setSnapshotProvider(provider: SnapshotProvider | null): this {
        this.snapshotProvider = provider
        return this
    }

    onRemote(type: string, handler: RemoteCommand): this {
        this.remoteHandlers[type] = handler
        return this
    }

    send(type: string, data: unknown): boolean {
        if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) return false
        try {
            this.socket.send(JSON.stringify({ type, t: Date.now(), data }))
            this.state.sent += 1
            return true
        } catch {
            return false
        }
    }

    connect(): void {
        this.disconnect()
        try {
            this.state.status = 'connecting'
            const socket = new WebSocket(this.state.url)
            this.socket = socket
            socket.addEventListener('open', this.onOpen)
            socket.addEventListener('close', this.onClose)
            socket.addEventListener('error', this.onError)
            socket.addEventListener('message', this.onMessage)
        } catch {
            this.state.status = 'error'
        }
    }

    disconnect(): void {
        if (this.socket !== null) {
            this.socket.removeEventListener('open', this.onOpen)
            this.socket.removeEventListener('close', this.onClose)
            this.socket.removeEventListener('error', this.onError)
            this.socket.removeEventListener('message', this.onMessage)
            try { this.socket.close() } catch { /* ignore */ }
            this.socket = null
        }
        this.state.status = 'closed'
    }

    private onOpen = (): void => {
        this.state.status = 'open'
    }

    private onClose = (): void => {
        this.state.status = 'closed'
    }

    private onError = (): void => {
        this.state.status = 'error'
    }

    private onMessage = (e: MessageEvent): void => {
        this.state.received += 1
        let parsed: { type?: string, data?: unknown } | null = null
        try {
            parsed = typeof e.data === 'string' ? JSON.parse(e.data) : null
        } catch {
            return
        }
        if (parsed === null || typeof parsed.type !== 'string') return
        const handler = this.remoteHandlers[parsed.type]
        if (handler !== undefined) handler(parsed.data)
    }

    override doUpdate(): void {
        if (this.socket?.readyState === WebSocket.OPEN && this.snapshotProvider !== null) {
            const now = Date.now()
            if (now - this.lastSnapshot >= this.state.snapshotMs) {
                this.lastSnapshot = now
                this.send('snapshot', this.snapshotProvider())
            }
        }
        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        this.disconnect()
        this.snapshotProvider = null
        this.remoteHandlers = {}
    }

}

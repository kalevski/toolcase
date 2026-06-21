import Panel from '../Panel'

interface TimelineEntry {
    time: number
    type: string
    name: string
}

interface TimelineState {
    paused: boolean
    log: string
    cursor: number
    historyLen: number
}

const MAX_HISTORY = 200
const VIEWPORT = 8

export default class TimelinePanel extends Panel {

    state: TimelineState = {
        paused: false,
        log: '',
        cursor: 0,
        historyLen: 0
    }

    components: Record<string, any> = {}

    private history: TimelineEntry[] = []

    private originalTrigger: ((event: string, payload: unknown, delay?: number) => unknown) | null = null

    override draw(): void {
        this.components.paused = this.base.addBinding(this.state, 'paused', { label: 'Paused' })
        this.components.paused.on('change', (e: { value: boolean }) => { this.scene.flow.active = !e.value })
        this.components.step = this.base.addButton({ title: 'Step (1 frame)' }).on('click', () => this.step())
        this.components.cursor = this.base.addBinding(this.state, 'cursor', { label: 'Scrub', min: 0, max: 1, step: 1 })
        this.components.cursor.on('change', () => this.refreshLog())
        this.components.clear = this.base.addButton({ title: 'Clear log' }).on('click', () => this.clear())
        this.components.log = this.base.addBinding(this.state, 'log', { readonly: true, label: 'Window' })
        this.hookFlow()
    }

    private hookFlow(): void {
        const events: any = this.scene.flow?.events
        if (!events || events.__hooked) return
        events.__hooked = true
        this.originalTrigger = events.trigger.bind(events)
        events.trigger = (event: string, payload: unknown, delay?: number) => {
            this.push({ time: ((this.game as any).loop?.time ?? 0), type: 'event', name: event })
            return this.originalTrigger!(event, payload, delay)
        }
    }

    private push(entry: TimelineEntry): void {
        this.history.push(entry)
        if (this.history.length > MAX_HISTORY) this.history.shift()
        this.state.historyLen = this.history.length
        this.state.cursor = Math.max(0, this.history.length - VIEWPORT)
    }

    private step(): void {
        if (!this.scene.flow.active) {
            const time = (this.game as any).loop?.time ?? 0
            const delta = (this.game as any).loop?.delta ?? 16.67
            this.scene.flow.active = true
            this.scene.flow.doUpdate(time, delta)
            this.scene.flow.active = false
        }
    }

    clear(): void {
        this.history.length = 0
        this.state.historyLen = 0
        this.state.cursor = 0
        this.state.log = ''
    }

    private refreshLog(): void {
        const start = Math.min(this.state.cursor, Math.max(0, this.history.length - VIEWPORT))
        const slice = this.history.slice(start, start + VIEWPORT)
        this.state.log = slice.map(e => `${e.time.toFixed(0)} ${e.type}:${e.name}`).join(' | ')
    }

    override doUpdate(): void {
        if (this.components.cursor) this.components.cursor.max = Math.max(0, this.history.length - 1)
        this.refreshLog()
        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        const events: any = this.scene.flow?.events
        if (events && this.originalTrigger !== null) {
            delete events.trigger
            delete events.__hooked
            this.originalTrigger = null
        }
    }

}

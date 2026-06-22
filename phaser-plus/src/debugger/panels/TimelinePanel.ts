import Panel from '../Panel'
import type { TimelineHandle } from '../../flow/TweenProcessor'

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
    tlScrub: number
    tlProgress: string
}

const MAX_HISTORY = 200
const VIEWPORT = 8

export default class TimelinePanel extends Panel {

    state: TimelineState = {
        paused: false,
        log: '',
        cursor: 0,
        historyLen: 0,
        tlScrub: 0,
        tlProgress: '--'
    }

    components: Record<string, any> = {}

    private history: TimelineEntry[] = []

    private originalTrigger: ((event: string, payload: unknown, delay?: number) => unknown) | null = null

    private _boundHandle: TimelineHandle | null = null

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

    bindTimeline(handle: TimelineHandle): void {
        this._boundHandle = handle
        this.state.tlScrub = 0
        this.components.tlScrub = this.base.addBinding(this.state, 'tlScrub', {
            label: 'TL Scrub',
            min: 0,
            max: 1,
            step: 0.001
        })
        this.components.tlScrub.on('change', (e: { value: number }) => {
            this._boundHandle?.seek(this._boundHandle.total * e.value)
        })
        this.components.tlProgress = this.base.addBinding(this.state, 'tlProgress', {
            readonly: true,
            label: 'TL Progress'
        })
        this.components.tlReplay = this.base.addButton({ title: 'Replay TL' }).on('click', () => {
            this._boundHandle?.restart()
        })
        this.components.tlPause = this.base.addButton({ title: 'Pause TL' }).on('click', () => {
            if (this._boundHandle?.paused) {
                this._boundHandle.resume()
            } else {
                this._boundHandle?.pause()
            }
        })
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

        const tweens: any = this.scene.flow?.tweens
        if (tweens && tweens.onLog === null) {
            tweens.onLog = (time: number, type: string, name: string) => {
                this.push({ time, type, name })
            }
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
        if (this._boundHandle !== null) {
            const h = this._boundHandle
            this.state.tlProgress = `${(h.progress * 100).toFixed(1)}% (${h.elapsed.toFixed(0)}ms)`
            if (!h.paused && !h.completed) {
                this.state.tlScrub = h.progress
            }
            this.components.tlProgress?.refresh?.()
        }
        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        const events: any = this.scene.flow?.events
        if (events && this.originalTrigger !== null) {
            delete events.trigger
            delete events.__hooked
            this.originalTrigger = null
        }
        const tweens: any = this.scene.flow?.tweens
        if (tweens) tweens.onLog = null
        this._boundHandle = null
    }

}

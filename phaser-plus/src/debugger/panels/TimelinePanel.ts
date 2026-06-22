import Panel from '../Panel'
import type { TimelineHandle } from '../../flow/TweenProcessor'
import ReplayRecorder, { REPLAY_FRAME, REPLAY_END } from '../../flow/ReplayRecorder'

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
    rpState: string
    rpFrame: string
    rpScrub: number
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
        tlProgress: '--',
        rpState: 'idle',
        rpFrame: '--',
        rpScrub: 0
    }

    components: Record<string, any> = {}

    private history: TimelineEntry[] = []

    private originalTrigger: ((event: string, payload: unknown, delay?: number) => unknown) | null = null

    private _boundHandle: TimelineHandle | null = null

    private _boundRecorder: ReplayRecorder | null = null

    private _onReplayFrame: ((...args: any[]) => void) | null = null

    private _onReplayEnd: ((...args: any[]) => void) | null = null

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

    /**
     * Bind a `ReplayRecorder` to this panel. Adds RP State / RP Frame readouts,
     * a scrub slider (seeks frame during playback), and Record / Stop / Replay
     * buttons. Each recorded `REPLAY_FRAME` is also appended to the history log.
     */
    bindReplay(recorder: ReplayRecorder): void {
        this._boundRecorder = recorder

        this.state.rpState = recorder.state
        this.state.rpFrame = '--'
        this.state.rpScrub = 0

        this.components.rpState = this.base.addBinding(this.state, 'rpState', {
            readonly: true,
            label: 'RP State'
        })
        this.components.rpFrame = this.base.addBinding(this.state, 'rpFrame', {
            readonly: true,
            label: 'RP Frame'
        })
        this.components.rpScrub = this.base.addBinding(this.state, 'rpScrub', {
            label: 'RP Scrub',
            min: 0,
            max: 1,
            step: 0.001
        })
        this.components.rpScrub.on('change', (e: { value: number }) => {
            const session = this._boundRecorder?.session
            if (!session || session.frames.length === 0) return
            this._boundRecorder?.seekTo(Math.floor(e.value * session.frames.length))
        })
        this.components.rpRecord = this.base.addButton({ title: 'RP Record' }).on('click', () => {
            this._boundRecorder?.record()
        })
        this.components.rpStop = this.base.addButton({ title: 'RP Stop' }).on('click', () => {
            this._boundRecorder?.stop()
        })
        this.components.rpReplay = this.base.addButton({ title: 'RP Replay' }).on('click', () => {
            const session = this._boundRecorder?.session
            if (!session || session.frames.length === 0) return
            this._boundRecorder?.play(session)
        })

        this._onReplayFrame = (tick: number) => {
            this.push({ time: (this.game as any).loop?.time ?? 0, type: 'replay', name: `frame:${tick}` })
        }
        this._onReplayEnd = () => {
            this.push({ time: (this.game as any).loop?.time ?? 0, type: 'replay', name: 'end' })
        }

        this.scene.features.on(REPLAY_FRAME, this._onReplayFrame)
        this.scene.features.on(REPLAY_END, this._onReplayEnd)
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
        if (this._boundRecorder !== null) {
            const r = this._boundRecorder
            this.state.rpState = r.state
            const session = r.session
            const total = session?.frames.length ?? 0
            this.state.rpFrame = total > 0
                ? `${Math.min(r.tick, total)} / ${total}`
                : '--'
            if (total > 0) {
                this.state.rpScrub = r.tick / total
            } else {
                this.state.rpScrub = 0
            }
            this.components.rpState?.refresh?.()
            this.components.rpFrame?.refresh?.()
            this.components.rpScrub?.refresh?.()
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
        if (this._onReplayFrame !== null) {
            this.scene.features.off(REPLAY_FRAME, this._onReplayFrame)
            this._onReplayFrame = null
        }
        if (this._onReplayEnd !== null) {
            this.scene.features.off(REPLAY_END, this._onReplayEnd)
            this._onReplayEnd = null
        }
        this._boundRecorder = null
    }

}

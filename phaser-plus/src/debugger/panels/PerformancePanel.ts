import Panel from '../Panel'

interface PerformanceState {
    fps: number
    frameMs: number
    drawCalls: number
    gcPauses: number
    longestMs: number
}

const GC_THRESHOLD_MS = 50

export default class PerformancePanel extends Panel {

    state: PerformanceState = {
        fps: 0,
        frameMs: 0,
        drawCalls: 0,
        gcPauses: 0,
        longestMs: 0
    }

    components: Record<string, any> = {}

    private lastDelta = 16.67

    override draw(): void {
        this.components.fps = this.base.addBinding(this.state, 'fps', { readonly: true, view: 'graph', label: 'FPS', min: 0, max: 120 })
        this.components.frameMs = this.base.addBinding(this.state, 'frameMs', { readonly: true, view: 'graph', label: 'Frame ms', min: 0, max: 50 })
        this.components.drawCalls = this.base.addBinding(this.state, 'drawCalls', { readonly: true, label: 'Draw calls' })
        this.components.gcPauses = this.base.addBinding(this.state, 'gcPauses', { readonly: true, label: 'GC pauses' })
        this.components.longestMs = this.base.addBinding(this.state, 'longestMs', { readonly: true, label: 'Worst ms' })
        this.components.reset = this.base.addButton({ title: 'Reset counters' }).on('click', () => this.reset())
    }

    reset(): void {
        this.state.gcPauses = 0
        this.state.longestMs = 0
    }

    override doUpdate(): void {
        const loop = (this.game as any).loop
        const delta = loop?.delta ?? 16.67
        const fps = loop?.actualFps ?? 0

        this.state.fps = Math.round(fps)
        this.state.frameMs = Math.round(delta * 100) / 100
        if (delta > this.state.longestMs) this.state.longestMs = Math.round(delta * 100) / 100
        if (delta > GC_THRESHOLD_MS && this.lastDelta < GC_THRESHOLD_MS) {
            this.state.gcPauses += 1
        }
        this.lastDelta = delta

        const renderer = this.game.renderer as any
        this.state.drawCalls = renderer?.drawCount ?? 0

        for (const key in this.components) this.components[key].refresh?.()
    }

}

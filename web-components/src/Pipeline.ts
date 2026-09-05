import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-pipeline'

export type PipelineStepState = 'default' | 'live' | 'complete'

export interface PipelineStep {
    title: string
    state?: PipelineStepState
    description?: string
    label?: string
}

const checkIconHtml = icon(Check, 'tc-pipeline-check-icon')

export class Pipeline extends HTMLElement {
    private _initialised = false
    private _steps: PipelineStep[] = []

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get steps(): PipelineStep[] {
        return this._steps
    }
    set steps(v: PipelineStep[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const total = this._steps.length

        const items = this._steps
            .map((step, index) => {
                const state = step.state ?? 'default'
                const isLive = state === 'live'
                const isComplete = state === 'complete'
                const ariaCurrent = isLive ? ' aria-current="step"' : ''
                const num = index + 1
                const isLast = index === total - 1

                const markerContent = isComplete
                    ? checkIconHtml
                    : `<span class="tc-pipeline-marker-num" aria-hidden="true">${num}</span>`

                const completeSrLabel = isComplete
                    ? `<span class="tc-pipeline-sr-only"> (complete)</span>`
                    : ''

                const connectorHtml = !isLast
                    ? `<span class="tc-pipeline-connector" aria-hidden="true"></span>`
                    : ''

                return `<li class="tc-pipeline-step tc-pipeline-step--${esc(state)}"${ariaCurrent}>
                <span class="tc-pipeline-marker">${markerContent}</span>
                <span class="tc-pipeline-title">${esc(String(step.title))}${completeSrLabel}</span>
                ${connectorHtml}
            </li>`
            })
            .join('')

        patchHtml(this, `<ol class="tc-pipeline">${items}</ol>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Pipeline
    }
}

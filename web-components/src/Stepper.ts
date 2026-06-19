import { esc } from './internal/esc'
import { Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-stepper'

export type StepperOrientation = 'horizontal' | 'vertical'

const ORIENTATIONS: StepperOrientation[] = ['horizontal', 'vertical']

export interface StepItem {
    key: string
    label: string
    description?: string
    optional?: boolean
}

const checkIconHtml = icon(Check, 'tc-stepper-check-icon')

type StepState = 'complete' | 'active' | 'pending'

function deriveState(steps: StepItem[], activeKey: string | null, idx: number): StepState {
    if (!activeKey) return 'pending'
    const activeIdx = steps.findIndex((s) => s.key === activeKey)
    if (activeIdx < 0) return 'pending'
    if (idx < activeIdx) return 'complete'
    if (idx === activeIdx) return 'active'
    return 'pending'
}

export class Stepper extends HTMLElement {
    private _initialised = false
    private _steps: StepItem[] = []

    onstepclick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-step', 'orientation', 'clickable']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Re-attach on every connect: disconnectedCallback removes this, and a
        // move/remount disconnects then reconnects without re-running the
        // one-time init above. Re-adding the same handler reference is a no-op.
        this.addEventListener('click', this._handleClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get steps(): StepItem[] {
        return this._steps
    }
    set steps(v: StepItem[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get activeStep(): string | null {
        return this.getAttribute('active-step')
    }
    set activeStep(v: string | null) {
        if (v != null) this.setAttribute('active-step', v)
        else this.removeAttribute('active-step')
    }

    get orientation(): StepperOrientation {
        const v = this.getAttribute('orientation') as StepperOrientation
        return ORIENTATIONS.includes(v) ? v : 'horizontal'
    }
    set orientation(v: StepperOrientation) {
        this.setAttribute('orientation', v)
    }

    get clickable(): boolean {
        return this.hasAttribute('clickable')
    }
    set clickable(v: boolean) {
        if (v) this.setAttribute('clickable', '')
        else this.removeAttribute('clickable')
    }

    private _handleClick = (e: MouseEvent): void => {
        if (!this.clickable) return
        const step = (e.target as HTMLElement).closest('.tc-stepper-step')
        if (!(step instanceof HTMLButtonElement)) return
        const key = step.dataset.stepKey
        if (!key) return
        this.dispatchEvent(
            new CustomEvent('tc-step-click', {
                bubbles: true,
                composed: true,
                detail: { key },
            }),
        )
        if (typeof this.onstepclick === 'function') this.onstepclick(key)
    }

    private render(): void {
        const orientation = this.orientation
        const activeKey = this.getAttribute('active-step')
        const clickable = this.clickable
        const total = this._steps.length

        const stepsHtml = this._steps
            .map((step, idx) => {
                const state = deriveState(this._steps, activeKey, idx)
                const isLast = idx === total - 1
                const num = idx + 1

                const markerContent =
                    state === 'complete'
                        ? checkIconHtml
                        : `<span class="tc-stepper-num" aria-hidden="true">${num}</span>`

                const descHtml = step.description
                    ? `<span class="tc-stepper-description">${esc(step.description)}</span>`
                    : ''

                const optionalHtml = step.optional
                    ? `<span class="tc-stepper-optional">(optional)</span>`
                    : ''

                const stateHint =
                    state === 'complete'
                        ? ' — complete'
                        : state === 'active'
                          ? ' — current step'
                          : ''
                const ariaLabel = `${esc(step.label)}${stateHint}`
                const ariaCurrent = state === 'active' ? ' aria-current="step"' : ''
                const dataKey = `data-step-key="${esc(step.key)}"`

                const inner =
                    `<span class="tc-stepper-marker" aria-hidden="true">${markerContent}</span>` +
                    `<span class="tc-stepper-body">` +
                    `<span class="tc-stepper-label">${esc(step.label)}</span>` +
                    descHtml +
                    optionalHtml +
                    `</span>`

                const stepEl = clickable
                    ? `<button type="button" class="tc-stepper-step tc-stepper-step-${state}" role="listitem"${ariaCurrent} aria-label="${ariaLabel}" ${dataKey}>${inner}</button>`
                    : `<div class="tc-stepper-step tc-stepper-step-${state}" role="listitem"${ariaCurrent} aria-label="${ariaLabel}">${inner}</div>`

                const connectorHtml = !isLast
                    ? `<span class="tc-stepper-connector tc-stepper-connector-${state}" aria-hidden="true"></span>`
                    : ''

                return stepEl + connectorHtml
            })
            .join('')

        this.innerHTML = `<div class="tc-stepper tc-stepper-${orientation}" role="list">${stepsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stepper
    }
}

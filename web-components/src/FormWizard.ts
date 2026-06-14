import * as LucideIcons from 'lucide-static'
import { Check, ChevronLeft, ChevronRight } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-form-wizard'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

export interface FormWizardStep {
    id?: string
    label: string
    icon?: string
    content?: HTMLElement | string | (() => HTMLElement)
}

const checkIconHtml = icon(Check, 'tc-form-wizard-check-icon')
const backIconHtml = icon(ChevronLeft, 'tc-form-wizard-chevron')
const nextIconHtml = icon(ChevronRight, 'tc-form-wizard-chevron')

export class FormWizard extends HTMLElement {
    private _initialised = false
    private _steps: FormWizardStep[] = []
    private _activeIndex = 0
    private _stepSlotNodes: Node[][] = []
    private _visitedIndices = new Set<number>([0])

    onComplete: (() => void) | null = null
    onStepChange: ((detail: { index: number }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['complete-label', 'complete-icon', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._captureSlotNodes()
            this.render()
            this._distributeActiveStepContent()
            this.addEventListener('click', this._handleClick)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rescueActiveSlotNodes()
        this.render()
        this._distributeActiveStepContent()
    }

    get steps(): FormWizardStep[] {
        return this._steps
    }
    set steps(v: FormWizardStep[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._steps.length > 0) {
            this._activeIndex = Math.min(this._activeIndex, this._steps.length - 1)
        } else {
            this._activeIndex = 0
        }
        if (this._initialised) {
            this._rescueActiveSlotNodes()
            this.render()
            this._distributeActiveStepContent()
        }
    }

    get completeLabel(): string {
        return this.getAttribute('complete-label') ?? 'Complete'
    }
    set completeLabel(v: string) {
        this.setAttribute('complete-label', v)
    }

    get completeIcon(): string | null {
        return this.getAttribute('complete-icon')
    }
    set completeIcon(v: string | null) {
        if (v != null) this.setAttribute('complete-icon', v)
        else this.removeAttribute('complete-icon')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── Slot capture ──────────────────────────────────────────────────────────

    private _captureSlotNodes(): void {
        this._stepSlotNodes = []
        Array.from(this.childNodes).forEach(node => {
            if (!(node instanceof Element)) return
            const slotAttr = node.getAttribute('slot')
            const dataStep = node.getAttribute('data-step')
            let idx = -1
            if (slotAttr !== null && slotAttr.startsWith('step-')) {
                const n = parseInt(slotAttr.slice(5), 10)
                if (!isNaN(n) && n >= 0) idx = n
            } else if (dataStep !== null) {
                const n = parseInt(dataStep, 10)
                if (!isNaN(n) && n >= 0) idx = n
            }
            if (idx >= 0) {
                if (!this._stepSlotNodes[idx]) this._stepSlotNodes[idx] = []
                this._stepSlotNodes[idx].push(node)
            }
        })
    }

    // Rescue the active step's slot nodes from the body before a re-render
    // overwrites innerHTML. Slot nodes moved into the body are kept alive in
    // _stepSlotNodes so they can be re-appended after the next render.
    private _rescueActiveSlotNodes(): void {
        const step = this._steps[this._activeIndex]
        if (step?.content != null) return       // JS property — nothing to rescue
        const body = this.querySelector('.tc-form-wizard-body')
        if (!body) return
        const nodes = Array.from(body.childNodes)
        if (nodes.length > 0) {
            this._stepSlotNodes[this._activeIndex] = nodes
        }
    }

    private _distributeActiveStepContent(): void {
        const body = this.querySelector('.tc-form-wizard-body')
        if (!body) return
        const step = this._steps[this._activeIndex]
        if (!step) return
        body.innerHTML = ''
        if (step.content != null) {
            if (typeof step.content === 'string') {
                body.innerHTML = step.content
            } else if (typeof step.content === 'function') {
                body.appendChild(step.content())
            } else {
                body.appendChild(step.content)
            }
        } else {
            const slotNodes = this._stepSlotNodes[this._activeIndex]
            if (slotNodes) {
                slotNodes.forEach(n => body.appendChild(n))
            }
        }
    }

    // ── Step navigation ───────────────────────────────────────────────────────

    private _changeStep(newIdx: number): void {
        if (newIdx === this._activeIndex) return
        if (newIdx < 0 || newIdx >= this._steps.length) return
        this._rescueActiveSlotNodes()
        this._activeIndex = newIdx
        this._visitedIndices.add(newIdx)
        this.render()
        this._distributeActiveStepContent()
        this.dispatchEvent(new CustomEvent('tc-step-change', {
            bubbles: true,
            composed: true,
            detail: { index: newIdx },
        }))
        if (typeof this.onStepChange === 'function') this.onStepChange({ index: newIdx })
    }

    // ── Event handling ────────────────────────────────────────────────────────

    private _handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement

        if (target.closest('.tc-form-wizard-back')) {
            if (!this.loading && this._activeIndex > 0) {
                this._changeStep(this._activeIndex - 1)
            }
            return
        }

        if (target.closest('.tc-form-wizard-next')) {
            if (!this.loading && this._activeIndex < this._steps.length - 1) {
                this._changeStep(this._activeIndex + 1)
            }
            return
        }

        if (target.closest('.tc-form-wizard-complete')) {
            if (!this.loading) {
                this.dispatchEvent(new CustomEvent('tc-complete', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }))
                if (typeof this.onComplete === 'function') this.onComplete()
            }
            return
        }

        const tab = target.closest<HTMLElement>('[data-step-index]')
        if (tab) {
            const idx = parseInt(tab.dataset.stepIndex ?? '', 10)
            if (!isNaN(idx) && this._visitedIndices.has(idx)) {
                this._changeStep(idx)
            }
            return
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private render(): void {
        const steps = this._steps
        const activeIdx = this._activeIndex
        const total = steps.length
        const isLast = total > 0 && activeIdx === total - 1
        const loading = this.loading
        const completeLabel = this.getAttribute('complete-label') ?? 'Complete'
        const completeIconName = this.getAttribute('complete-icon')
        const completeIconHtml = completeIconName ? lucideByName(completeIconName) : ''

        // ── Stepper header ───────────────────────────────────────────────────
        const tabsHtml = steps.map((step, i) => {
            const isDone = i < activeIdx
            const isCurrent = i === activeIdx
            const state: 'done' | 'current' | 'upcoming' = isDone ? 'done' : isCurrent ? 'current' : 'upcoming'

            let markerContent: string
            if (isDone) {
                markerContent = checkIconHtml
            } else if (step.icon) {
                markerContent = lucideByName(step.icon)
            } else {
                markerContent = `<span class="tc-form-wizard-tab-num" aria-hidden="true">${i + 1}</span>`
            }

            const ariaSelected = isCurrent ? 'true' : 'false'
            const ariaCurrent = isCurrent ? ' aria-current="step"' : ''
            const ariaDisabled = state === 'upcoming' ? ' aria-disabled="true"' : ''
            const tabIndex = isCurrent ? '0' : '-1'

            const connectorHtml = i < total - 1
                ? `<span class="tc-form-wizard-connector tc-form-wizard-connector--${state}" aria-hidden="true"></span>`
                : ''

            return (
                `<button type="button" class="tc-form-wizard-tab tc-form-wizard-tab--${state}"` +
                ` role="tab" aria-selected="${ariaSelected}"${ariaCurrent}${ariaDisabled}` +
                ` tabindex="${tabIndex}" data-step-index="${i}"` +
                `>` +
                `<span class="tc-form-wizard-tab-marker" aria-hidden="true">${markerContent}</span>` +
                `<span class="tc-form-wizard-tab-label">${esc(step.label)}</span>` +
                `</button>` +
                connectorHtml
            )
        }).join('')

        // ── Footer buttons ───────────────────────────────────────────────────
        const spinnerHtml = loading
            ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
            : ''

        const backHtml =
            `<button type="button" class="tc-form-wizard-back btn btn-outline-secondary"` +
            (activeIdx === 0 || loading ? ' disabled' : '') +
            `>` +
            backIconHtml +
            `<span>Back</span>` +
            `</button>`

        const actionHtml = isLast
            ? (`<button type="button" class="tc-form-wizard-complete btn btn-primary"` +
               (loading ? ' disabled' : '') +
               `>` +
               spinnerHtml +
               completeIconHtml +
               `<span>${esc(completeLabel)}</span>` +
               `</button>`)
            : (`<button type="button" class="tc-form-wizard-next btn btn-primary"` +
               (loading ? ' disabled' : '') +
               `>` +
               spinnerHtml +
               `<span>Next</span>` +
               nextIconHtml +
               `</button>`)

        const activeLabel = steps[activeIdx]?.label ?? 'Step content'

        this.innerHTML =
            `<div class="tc-form-wizard-steps" role="tablist" aria-label="Form steps">` +
            tabsHtml +
            `</div>` +
            `<div class="tc-form-wizard-body" role="tabpanel" aria-label="${esc(activeLabel)}">` +
            `</div>` +
            `<div class="tc-form-wizard-footer">` +
            backHtml +
            actionHtml +
            `</div>`

        // Arrow-key tablist navigation — listener lives on the header div which
        // is recreated on every render, so no manual cleanup is needed.
        const header = this.querySelector<HTMLElement>('.tc-form-wizard-steps')
        if (header) {
            header.addEventListener('keydown', (e: KeyboardEvent) => {
                if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
                e.preventDefault()
                const tabs = Array.from(this.querySelectorAll<HTMLElement>('.tc-form-wizard-tab'))
                const focused = document.activeElement as HTMLElement
                const curPos = tabs.indexOf(focused)
                if (curPos === -1) return
                if (e.key === 'ArrowRight') tabs[Math.min(curPos + 1, tabs.length - 1)]?.focus()
                else if (e.key === 'ArrowLeft') tabs[Math.max(curPos - 1, 0)]?.focus()
                else if (e.key === 'Home') tabs[0]?.focus()
                else if (e.key === 'End') tabs[tabs.length - 1]?.focus()
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FormWizard
    }
}

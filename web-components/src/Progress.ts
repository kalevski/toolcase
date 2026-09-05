import { patchHtml } from './internal/patch-html'
import { VARIANTS_FULL } from './internal/variants'
const TAG_NAME = 'tc-progress'

export type ProgressVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const VARIANTS: ProgressVariant[] = [...VARIANTS_FULL]

export class Progress extends HTMLElement {
    private _initialised = false
    private _stacked = false

    static get observedAttributes(): string[] {
        return ['value', 'min', 'max', 'variant', 'striped', 'animated', 'label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const barChildren = Array.from(
                this.querySelectorAll<Element>(':scope > tc-progress-bar'),
            )
            this._stacked = barChildren.length > 0
            this._render(barChildren)
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (!this._stacked) {
            this._render([])
        }
    }

    get value(): number {
        return parseFloat(this.getAttribute('value') ?? '0') || 0
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get min(): number {
        return parseFloat(this.getAttribute('min') ?? '0') || 0
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        return raw !== null ? parseFloat(raw) || 100 : 100
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get variant(): ProgressVariant | null {
        const v = this.getAttribute('variant') as ProgressVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: ProgressVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get striped(): boolean {
        return this.hasAttribute('striped')
    }
    set striped(v: boolean) {
        if (v) this.setAttribute('striped', '')
        else this.removeAttribute('striped')
    }

    get animated(): boolean {
        return this.hasAttribute('animated')
    }
    set animated(v: boolean) {
        if (v) this.setAttribute('animated', '')
        else this.removeAttribute('animated')
    }

    get label(): boolean {
        return this.hasAttribute('label')
    }
    set label(v: boolean) {
        if (v) this.setAttribute('label', '')
        else this.removeAttribute('label')
    }

    private _render(barChildren: Element[]): void {
        if (barChildren.length > 0) {
            patchHtml(this, `<div class="progress-stacked"></div>`)
            const stacked = this.querySelector('.progress-stacked')!
            barChildren.forEach((bar) => stacked.appendChild(bar))
        } else {
            const value = this.value
            const min = this.min
            const max = this.max
            const variant = this.variant
            const striped = this.striped
            const animated = this.animated
            const showLabel = this.label

            const range = max - min || 1
            const pct = Math.min(100, Math.max(0, ((value - min) / range) * 100))

            const variantClass = variant ? ` bg-${variant}` : ''
            const stripedClass = striped ? ' progress-bar-striped' : ''
            const animatedClass = animated ? ' progress-bar-animated' : ''
            const labelText = showLabel ? `${Math.round(pct)}%` : ''

            patchHtml(
                this,
                `<div class="progress" role="progressbar" aria-valuenow="${value}" aria-valuemin="${min}" aria-valuemax="${max}"><div class="progress-bar${variantClass}${stripedClass}${animatedClass}" style="width:${pct}%">${labelText}</div></div>`,
            )
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Progress
    }
}

import { VARIANTS_FULL } from './internal/variants'
const TAG_NAME = 'tc-progress-bar'

export type ProgressBarVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'

const VARIANTS: ProgressBarVariant[] = [...VARIANTS_FULL]

export class ProgressBar extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'variant', 'striped', 'animated', 'label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._render()
    }

    get value(): number {
        return parseFloat(this.getAttribute('value') ?? '0') || 0
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get variant(): ProgressBarVariant | null {
        const v = this.getAttribute('variant') as ProgressBarVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: ProgressBarVariant | null) {
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

    private _render(): void {
        const value = this.value
        const variant = this.variant
        const striped = this.striped
        const animated = this.animated
        const showLabel = this.label

        const pct = Math.min(100, Math.max(0, value))

        const variantClass = variant ? ` bg-${variant}` : ''
        const stripedClass = striped ? ' progress-bar-striped' : ''
        const animatedClass = animated ? ' progress-bar-animated' : ''
        const labelText = showLabel ? `${Math.round(pct)}%` : ''

        this.innerHTML = `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="width:${pct}%"><div class="progress-bar${variantClass}${stripedClass}${animatedClass}">${labelText}</div></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ProgressBar
    }
}

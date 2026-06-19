import { VARIANTS_FULL } from './internal/variants'
const TAG_NAME = 'tc-spinner'

export type SpinnerType = 'border' | 'grow' | 'dots' | 'bars' | 'pulse' | 'orbit'
export type SpinnerVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'

const TYPES: SpinnerType[] = ['border', 'grow', 'dots', 'bars', 'pulse', 'orbit']
const VARIANTS: SpinnerVariant[] = [...VARIANTS_FULL]

export class Spinner extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['type', 'variant', 'size', 'label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get type(): SpinnerType {
        const t = this.getAttribute('type') as SpinnerType
        return TYPES.includes(t) ? t : 'border'
    }
    set type(v: SpinnerType) {
        this.setAttribute('type', v)
    }

    get variant(): SpinnerVariant | null {
        const v = this.getAttribute('variant') as SpinnerVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: SpinnerVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get size(): boolean {
        return this.getAttribute('size') === 'sm'
    }
    set size(v: boolean) {
        if (v) this.setAttribute('size', 'sm')
        else this.removeAttribute('size')
    }

    get label(): string {
        return this.getAttribute('label') ?? 'Loading…'
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    private render(): void {
        const type = this.type
        const variant = this.variant
        const small = this.size
        const label = this.label

        const variantClass = variant ? ` text-${variant}` : ''
        const sizeClass = small ? ` spinner-${type}-sm` : ''
        const segments =
            type === 'dots' || type === 'bars' ? '<span></span><span></span><span></span>' : ''

        this.innerHTML = `<div class="spinner-${type}${variantClass}${sizeClass}" role="status">${segments}<span class="visually-hidden">${label}</span></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Spinner
    }
}

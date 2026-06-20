import { VARIANTS_FULL } from './internal/variants'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-badge'

export type BadgeVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'

const VARIANTS: BadgeVariant[] = [...VARIANTS_FULL]

export class Badge extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'pill', 'text']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('text')) {
                const inner = this.querySelector('.tc-badge-content')
                if (inner) slotContent.forEach((n) => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-badge-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('text')) {
            const newInner = this.querySelector('.tc-badge-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
    }

    get variant(): BadgeVariant {
        const v = this.getAttribute('variant') as BadgeVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: BadgeVariant) {
        this.setAttribute('variant', v)
    }

    get pill(): boolean {
        return this.hasAttribute('pill')
    }
    set pill(v: boolean) {
        if (v) this.setAttribute('pill', '')
        else this.removeAttribute('pill')
    }

    get text(): string | null {
        return this.getAttribute('text')
    }
    set text(v: string | null) {
        if (v != null) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    private render(): void {
        const variant = this.variant
        const pill = this.pill
        const text = this.getAttribute('text')
        const pillClass = pill ? ' rounded-pill' : ''
        if (text != null) {
            this.innerHTML = `<span class="badge text-bg-${variant}${pillClass}">${esc(text)}</span>`
        } else {
            this.innerHTML = `<span class="badge text-bg-${variant}${pillClass}"><span class="tc-badge-content"></span></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Badge
    }
}

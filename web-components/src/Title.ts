import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-title'

export type TitleAlign = 'left' | 'center' | 'right'
const ALIGNS: TitleAlign[] = ['left', 'center', 'right']

export class Title extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['size', 'align']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // NOTE: HTMLElement.title is a native reflected attribute — getter/setter
    // deliberately omitted to avoid colliding with the platform property.

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    get align(): TitleAlign {
        const raw = this.getAttribute('align') as TitleAlign
        return ALIGNS.includes(raw) ? raw : 'left'
    }
    set align(value: TitleAlign) {
        setAttr(this, 'align', value)
    }

    private render(): void {
        // THE HOST IS THE TITLE — no content wrapper to move children into.
        setHostClass(this, 'tc-title')
        this.dataset.align = this.align

        const sz = this.size
        if (sz != null) this.style.setProperty('--bs-title-font-size', `${sz}px`)
        else this.style.removeProperty('--bs-title-font-size')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Title
    }
}

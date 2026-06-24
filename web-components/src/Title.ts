const TAG_NAME = 'tc-title'

export type TitleAlign = 'left' | 'center' | 'right'
const ALIGNS: TitleAlign[] = ['left', 'center', 'right']

export class Title extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['size', 'align']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-title-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-title-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-title-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
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
        this.setAttribute('align', value)
    }

    private render(): void {
        this.classList.add('tc-title')
        this.dataset.align = this.align

        const sz = this.size
        if (sz != null) this.style.setProperty('--bs-title-font-size', `${sz}px`)
        else this.style.removeProperty('--bs-title-font-size')

        this.innerHTML = `<div class="tc-title-content"></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Title
    }
}

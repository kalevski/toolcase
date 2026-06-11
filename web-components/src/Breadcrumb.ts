const TAG_NAME = 'tc-breadcrumb'

export class Breadcrumb extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['divider']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const ol = this.querySelector('ol.breadcrumb')
            if (ol) slotContent.forEach(n => ol.appendChild(n))
            this._updateDivider()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._updateDivider()
    }

    get divider(): string | null {
        return this.getAttribute('divider')
    }
    set divider(v: string | null) {
        if (v != null) this.setAttribute('divider', v)
        else this.removeAttribute('divider')
    }

    private _updateDivider(): void {
        const nav = this.querySelector<HTMLElement>('nav')
        if (!nav) return
        const d = this.getAttribute('divider')
        if (d != null) {
            const escaped = d.replace(/'/g, "\\'")
            nav.style.setProperty('--bs-breadcrumb-divider', `'${escaped}'`)
        } else {
            nav.style.removeProperty('--bs-breadcrumb-divider')
        }
    }

    private render(): void {
        this.innerHTML = `<nav aria-label="breadcrumb"><ol class="breadcrumb"></ol></nav>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Breadcrumb
    }
}

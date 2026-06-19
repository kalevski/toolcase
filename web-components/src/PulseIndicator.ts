import { esc } from './internal/esc'
const TAG_NAME = 'tc-pulse-indicator'

export class PulseIndicator extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'color', 'paused']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.setAttribute('role', 'status')
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('label')) {
                const labelEl = this.querySelector('.tc-pulse-indicator-label')
                if (labelEl) slotContent.forEach((n) => labelEl.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const labelEl = this.querySelector('.tc-pulse-indicator-label')
        const slotContent =
            !this.hasAttribute('label') && labelEl ? Array.from(labelEl.childNodes) : []
        this.render()
        if (!this.hasAttribute('label')) {
            const newLabelEl = this.querySelector('.tc-pulse-indicator-label')
            if (newLabelEl) slotContent.forEach((n) => newLabelEl.appendChild(n))
        }
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get paused(): boolean {
        return this.hasAttribute('paused')
    }
    set paused(v: boolean) {
        if (v) this.setAttribute('paused', '')
        else this.removeAttribute('paused')
    }

    private render(): void {
        const label = this.getAttribute('label')
        const color = this.getAttribute('color')
        const paused = this.hasAttribute('paused')
        const pausedClass = paused ? ' tc-pulse-indicator--paused' : ''

        if (color) {
            this.style.setProperty('--bs-pulse-indicator-color', color)
        } else {
            this.style.removeProperty('--bs-pulse-indicator-color')
        }

        const dotHtml = `<span class="tc-pulse-indicator-dot" aria-hidden="true"></span>`
        if (label != null) {
            this.innerHTML = `<span class="tc-pulse-indicator${pausedClass}">${dotHtml}<span class="tc-pulse-indicator-label">${esc(label)}</span></span>`
        } else {
            this.innerHTML = `<span class="tc-pulse-indicator${pausedClass}">${dotHtml}<span class="tc-pulse-indicator-label"></span></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PulseIndicator
    }
}

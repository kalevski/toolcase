const TAG_NAME = 'tc-divider'

export class Divider extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['vertical', 'label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('label')) {
                const inner = this.querySelector('.tc-divider__label')
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-divider__label')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('label')) {
            const newInner = this.querySelector('.tc-divider__label')
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        }
    }

    get vertical(): boolean {
        return this.hasAttribute('vertical')
    }
    set vertical(v: boolean) {
        if (v) this.setAttribute('vertical', '')
        else this.removeAttribute('vertical')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    private render(): void {
        const vertical = this.vertical
        const label = this.getAttribute('label')
        const orientation = vertical ? 'vertical' : 'horizontal'
        const dirClass = vertical ? 'tc-divider--vertical' : 'tc-divider--horizontal'

        if (label != null) {
            // aria-label makes the separator name accessible when using the attribute
            this.innerHTML = `<div class="tc-divider ${dirClass}" role="separator" aria-orientation="${orientation}" aria-label="${this._escape(label)}"><span class="tc-divider__label">${this._escape(label)}</span></div>`
        } else {
            // Empty label span is hidden via CSS :empty; slotted children are
            // appended to it by connectedCallback / attributeChangedCallback.
            this.innerHTML = `<div class="tc-divider ${dirClass}" role="separator" aria-orientation="${orientation}"><span class="tc-divider__label"></span></div>`
        }
    }

    // Minimal HTML escape so dynamic label values don't inject markup.
    private _escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Divider
    }
}

import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { syncOwnedNodes } from './internal/tc-element'
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
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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

    /** THE HOST IS THE SEPARATOR. The rules are `::before`/`::after` on the host,
     *  so the label — the attribute's, or the consumer's own children — sits
     *  between them without anything being wrapped or moved (rule 1). */
    private render(): void {
        const vertical = this.vertical
        const label = this.getAttribute('label')
        const dirClass = vertical ? 'tc-divider--vertical' : 'tc-divider--horizontal'

        setHostClass(this, `tc-divider ${dirClass}`)
        this.setAttribute('role', 'separator')
        this.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal')
        // aria-label names the separator when the label came in as an attribute.
        if (label != null) this.setAttribute('aria-label', label)
        else this.removeAttribute('aria-label')

        syncOwnedNodes(this, [
            { cls: 'tc-divider__label', tag: 'span', html: label != null ? esc(label) : null },
        ])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Divider
    }
}

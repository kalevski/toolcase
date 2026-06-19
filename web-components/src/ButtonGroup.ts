const TAG_NAME = 'tc-button-group'

export type ButtonGroupSize = 'sm' | 'lg'

const SIZES: ButtonGroupSize[] = ['sm', 'lg']

export class ButtonGroup extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['vertical', 'size', 'aria-label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector<HTMLElement>('[role="group"]')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._updateGroup()
    }

    get vertical(): boolean {
        return this.hasAttribute('vertical')
    }
    set vertical(v: boolean) {
        if (v) this.setAttribute('vertical', '')
        else this.removeAttribute('vertical')
    }

    get size(): ButtonGroupSize | null {
        const v = this.getAttribute('size') as ButtonGroupSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: ButtonGroupSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    private render(): void {
        const vertical = this.vertical
        const size = this.size
        const label = this.getAttribute('aria-label') ?? ''

        const sizeClass = size ? ` btn-group-${size}` : ''
        const dirClass = vertical ? 'btn-group-vertical' : 'btn-group'
        const labelAttr = label ? ` aria-label="${label}"` : ''

        this.innerHTML = `<div class="${dirClass}${sizeClass}" role="group"${labelAttr}></div>`
    }

    private _updateGroup(): void {
        const inner = this.querySelector<HTMLElement>('[role="group"]')
        if (!inner) return

        const vertical = this.vertical
        const size = this.size
        const label = this.getAttribute('aria-label')

        const sizeClass = size ? ` btn-group-${size}` : ''
        inner.className = vertical ? `btn-group-vertical${sizeClass}` : `btn-group${sizeClass}`

        if (label != null) {
            inner.setAttribute('aria-label', label)
        } else {
            inner.removeAttribute('aria-label')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ButtonGroup
    }
}

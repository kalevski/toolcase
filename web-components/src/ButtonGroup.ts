import { setHostClass } from './internal/host-class'
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

        // THE HOST IS THE GROUP.
        setHostClass(this, `${dirClass}${sizeClass}`)
        this.setAttribute('role', 'group')
        if (label) this.setAttribute('aria-label', label)
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

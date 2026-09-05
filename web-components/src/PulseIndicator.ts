import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { syncOwnedNodes, syncTrailingNodes } from './internal/tc-element'
const TAG_NAME = 'tc-pulse-indicator'

export class PulseIndicator extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['label', 'color', 'paused', 'class']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.setAttribute('role', 'status')
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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

    /** THE HOST IS THE INDICATOR: the flex row is the consumer's own tag, the dot
     *  is prepended and the label — when the `label` attribute supplies one — is
     *  appended after whatever children the consumer wrote (rule 1). */
    private render(): void {
        const label = this.getAttribute('label')
        const color = this.getAttribute('color')
        const pausedClass = this.hasAttribute('paused') ? ' tc-pulse-indicator--paused' : ''

        if (color) this.style.setProperty('--bs-pulse-indicator-color', color)
        else this.style.removeProperty('--bs-pulse-indicator-color')

        setHostClass(this, `tc-pulse-indicator${pausedClass}`)

        syncOwnedNodes(this, [{ cls: 'tc-pulse-indicator-dot', tag: 'span', html: '' }])
        this.querySelector(':scope > .tc-pulse-indicator-dot')?.setAttribute('aria-hidden', 'true')
        syncTrailingNodes(this, [
            {
                cls: 'tc-pulse-indicator-label',
                tag: 'span',
                html: label != null ? esc(label) : null,
            },
        ])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PulseIndicator
    }
}

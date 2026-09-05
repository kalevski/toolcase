import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-input-group-text'

export class InputGroupText extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['class']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        // THE HOST IS THE ADDON: `.input-group-text` goes on the consumer's own tag
        // rather than on a span their children get moved into (rule 1).
        this._initialised = true
        setHostClass(this, 'input-group-text')
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        setHostClass(this, 'input-group-text')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InputGroupText
    }
}

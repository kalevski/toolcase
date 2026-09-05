import { setHostClass } from './internal/host-class'
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
        this._initialised = true
        this.render()
        this._updateDivider()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._updateDivider()
    }

    private _updateDivider(): void {
        const d = this.getAttribute('divider')
        if (d != null) {
            const escaped = d.replace(/'/g, "\\'")
            this.style.setProperty('--bs-breadcrumb-divider', `'${escaped}'`)
        } else {
            this.style.removeProperty('--bs-breadcrumb-divider')
        }
    }

    /** THE HOST IS THE TRAIL: `.breadcrumb` and the navigation semantics land on
     *  the consumer's own tag, so their crumbs are never re-parented (rule 1). */
    private render(): void {
        setHostClass(this, 'breadcrumb')
        this.setAttribute('role', 'navigation')
        this.setAttribute('aria-label', 'breadcrumb')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Breadcrumb
    }
}

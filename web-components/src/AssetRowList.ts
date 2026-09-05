import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-asset-row-list'

export class AssetRowList extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const body = this.querySelector('.tc-asset-row-list-body')
        const slotContent = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-asset-row-list-body')
        if (newBody) slotContent.forEach((n) => newBody.appendChild(n))
    }

    /** THE HOST IS THE LIST: the rows the consumer wrote stay direct children of
     *  their own tag rather than being moved into a body wrapper (rule 1). */
    private render(): void {
        setHostClass(this, 'tc-asset-row-list tc-asset-row-list-body')
        this.setAttribute('role', 'list')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AssetRowList
    }
}

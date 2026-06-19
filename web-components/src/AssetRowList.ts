const TAG_NAME = 'tc-asset-row-list'

export class AssetRowList extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-asset-row-list-body')
            if (body) slotContent.forEach((n) => body.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const body = this.querySelector('.tc-asset-row-list-body')
        const slotContent = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-asset-row-list-body')
        if (newBody) slotContent.forEach((n) => newBody.appendChild(n))
    }

    private render(): void {
        this.innerHTML =
            `<div class="tc-asset-row-list">` +
            `<div class="tc-asset-row-list-body" role="list"></div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AssetRowList
    }
}

const TAG_NAME = 'tc-dashboard-content'

export class DashboardContent extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-dashboard-content-inner')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    private render(): void {
        this.innerHTML = `<main class="tc-dashboard-content"><div class="tc-dashboard-content-inner"></div></main>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DashboardContent
    }
}

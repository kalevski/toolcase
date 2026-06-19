const TAG_NAME = 'tc-dashboard-sidebar'

export class DashboardSidebar extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture each named-slot region before render() wipes innerHTML
            const brandNodes = Array.from(this.querySelectorAll('[slot="brand"]'))
            const menuNodes = Array.from(this.querySelectorAll('[slot="menu"]'))
            const panelNodes = Array.from(this.querySelectorAll('[slot="panel"]'))

            this.render()

            // Distribute slot nodes into their respective containers
            const brandEl = this.querySelector('.tc-dashboard-sidebar-brand')
            if (brandEl) brandNodes.forEach((n) => brandEl.appendChild(n))
            const menuEl = this.querySelector('.tc-dashboard-sidebar-menu')
            if (menuEl) menuNodes.forEach((n) => menuEl.appendChild(n))
            const panelEl = this.querySelector('.tc-dashboard-sidebar-panel')
            if (panelEl) panelNodes.forEach((n) => panelEl.appendChild(n))

            this._initialised = true
        }
    }

    private render(): void {
        this.innerHTML = `<aside class="tc-dashboard-sidebar" role="complementary"><div class="tc-dashboard-sidebar-brand"></div><nav class="tc-dashboard-sidebar-menu"></nav><div class="tc-dashboard-sidebar-panel"></div></aside>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DashboardSidebar
    }
}

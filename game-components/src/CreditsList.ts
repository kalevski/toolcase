const TAG_NAME = 'gc-credits-list'

export interface CreditsSection {
    role: string
    names: string[]
}

export class CreditsList extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _sections: CreditsSection[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    get sections(): CreditsSection[] {
        return this._sections.slice()
    }
    set sections(value: CreditsSection[]) {
        this._sections = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const sectionsMarkup = this._sections.map((s) => {
            const names = (s.names || []).map((n) => `<div class="gc-credits-list-name">${this.escape(n)}</div>`).join('')
            return `<div class="gc-credits-list-section">
                <div class="gc-credits-list-role">${this.escape(s.role)}</div>
                <div class="gc-credits-list-names">${names}</div>
            </div>`
        }).join('')

        this.innerHTML = sectionsMarkup
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, CreditsList)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CreditsList
    }
}

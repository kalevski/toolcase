const TAG_NAME = 'tc-credits-list'

export interface CreditsSection {
    role: string
    names: string[]
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class CreditsList extends HTMLElement {
    private _initialised = false
    private _sections: CreditsSection[] = []

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get sections(): CreditsSection[] {
        return this._sections
    }
    set sections(v: CreditsSection[]) {
        this._sections = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        this.classList.add('tc-credits-list')
        // `role="list"` mirrors the source component's accessibility contract.
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')

        this.innerHTML = this._sections
            .map(section => {
                const names = (Array.isArray(section.names) ? section.names : [])
                    .map(name => `<div class="tc-credits-list-name">${esc(name)}</div>`)
                    .join('')
                return `<div class="tc-credits-list-section" role="listitem"><div class="tc-credits-list-role">${esc(section.role)}</div><div class="tc-credits-list-names">${names}</div></div>`
            })
            .join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CreditsList
    }
}

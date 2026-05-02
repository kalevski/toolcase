const TAG_NAME = 'gc-settings-category-list'

export interface SettingsCategory {
    id: string
    label: string
    icon?: string
}

export interface SettingsCategoryListEventMap {
    select: CustomEvent<{ id: string }>
}

export class SettingsCategoryList extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    private _categories: SettingsCategory[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.ensureSkeleton()
        this.renderNav()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this.renderNav()
    }

    get categories(): SettingsCategory[] {
        return this._categories
    }
    set categories(value: SettingsCategory[]) {
        this._categories = Array.isArray(value) ? value : []
        if (this.isConnected) this.renderNav()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(value: string) {
        if (value) this.setAttribute('selected-id', value)
        else this.removeAttribute('selected-id')
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private ensureSkeleton(): void {
        if (this.querySelector(':scope > [data-gc-settings-nav]')) return
        const existing = Array.from(this.childNodes)
        const nav = document.createElement('nav')
        nav.dataset.gcSettingsNav = ''
        nav.setAttribute('role', 'tablist')
        nav.className = 'gc-settings-category-list-nav'
        const body = document.createElement('div')
        body.dataset.gcSettingsContent = ''
        body.setAttribute('role', 'tabpanel')
        body.className = 'gc-settings-category-list-body'
        existing.forEach((c) => body.appendChild(c))
        this.replaceChildren(nav, body)
    }

    private renderNav(): void {
        const nav = this.querySelector(':scope > [data-gc-settings-nav]') as HTMLElement | null
        if (!nav) return
        const selected = this.selectedId
        nav.innerHTML = this._categories.map((cat) => {
            const isSelected = cat.id === selected
            const iconMarkup = cat.icon
                ? (cat.icon.startsWith('bi-') || cat.icon.startsWith('bi ')
                    ? `<i class="gc-settings-category-icon ${this.escape(cat.icon.startsWith('bi ') ? cat.icon : `bi ${cat.icon}`)}"></i>`
                    : `<span class="gc-settings-category-icon">${this.escape(cat.icon)}</span>`)
                : ''
            const cls = `gc-settings-category${isSelected ? ' is-selected' : ''}`
            const ariaCurrent = isSelected ? ' aria-current="true"' : ''
            return `<button type="button" role="tab" tabindex="${isSelected ? '0' : '-1'}" aria-selected="${isSelected}"${ariaCurrent} class="${cls}" data-id="${this.escape(cat.id)}">${iconMarkup}<span class="gc-settings-category-label">${this.escape(cat.label)}</span></button>`
        }).join('')

        nav.querySelectorAll<HTMLElement>('.gc-settings-category').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.id || ''
                if (!id || id === this.selectedId) return
                this.selectedId = id
                this.emit('select', { id })
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, SettingsCategoryList)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SettingsCategoryList
    }
}

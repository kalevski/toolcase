const TAG_NAME = 'gc-tab-bar'

export type TabBarSize = 'sm' | 'md'

export interface TabItem {
    id: string
    label: string
    icon?: string
}

export interface TabBarEventMap {
    change: CustomEvent<{ id: string }>
}

export class TabBar extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['active-id', 'size']
    }

    private _tabs: TabItem[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get tabs(): TabItem[] {
        return this._tabs
    }
    set tabs(value: TabItem[]) {
        this._tabs = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    get activeId(): string {
        return this.getAttribute('active-id') ?? ''
    }
    set activeId(value: string) {
        if (value) this.setAttribute('active-id', value)
        else this.removeAttribute('active-id')
    }

    get size(): TabBarSize {
        return (this.getAttribute('size') as TabBarSize) || 'md'
    }
    set size(value: TabBarSize) {
        this.setAttribute('size', value)
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

    private render(): void {
        const active = this.activeId
        const parts = this._tabs.map((tab) => {
            const isActive = tab.id === active
            const iconMarkup = tab.icon
                ? (tab.icon.startsWith('bi-') || tab.icon.startsWith('bi ')
                    ? `<i class="gc-tab-bar-icon ${this.escape(tab.icon.startsWith('bi ') ? tab.icon : `bi ${tab.icon}`)}"></i>`
                    : `<span class="gc-tab-bar-icon">${this.escape(tab.icon)}</span>`)
                : ''
            return `<button type="button" role="tab" tabindex="${isActive ? '0' : '-1'}" aria-selected="${isActive}" data-id="${this.escape(tab.id)}" class="gc-tab-bar-tab${isActive ? ' is-active' : ''}">${iconMarkup}<span class="gc-tab-bar-label">${this.escape(tab.label)}</span></button>`
        })
        this.innerHTML = parts.join('')
        this.querySelectorAll<HTMLButtonElement>('.gc-tab-bar-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id || ''
                if (id && id !== this.activeId) {
                    this.activeId = id
                    this.emit('change', { id })
                }
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TabBar
    }
}

const TAG_NAME = 'gc-main-menu'

export interface MainMenuItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

export interface MainMenuEventMap {
    select: CustomEvent<{ id: string }>
}

export class MainMenu extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id', 'menu-title', 'subtitle']
    }

    private _items: MainMenuItem[] = []
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'menu')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        this.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get items(): MainMenuItem[] {
        return this._items
    }
    set items(value: MainMenuItem[]) {
        this._items = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(value: string) {
        if (value) this.setAttribute('selected-id', value)
        else this.removeAttribute('selected-id')
    }

    get menuTitle(): string {
        return this.getAttribute('menu-title') ?? ''
    }
    set menuTitle(value: string) {
        if (value) this.setAttribute('menu-title', value)
        else this.removeAttribute('menu-title')
    }

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(value: string) {
        if (value) this.setAttribute('subtitle', value)
        else this.removeAttribute('subtitle')
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

    private enabledIndex(from: number, dir: 1 | -1): number {
        const n = this._items.length
        if (n === 0) return -1
        let i = from
        for (let step = 0; step < n; step++) {
            i = (i + dir + n) % n
            if (!this._items[i].disabled) return i
        }
        return -1
    }

    private handleKey(event: KeyboardEvent): void {
        const n = this._items.length
        if (n === 0) return
        const currentIdx = this._items.findIndex((i) => i.id === this.selectedId)
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = this.enabledIndex(currentIdx >= 0 ? currentIdx : -1, 1)
            if (next >= 0) this.selectedId = this._items[next].id
            return
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = this.enabledIndex(currentIdx >= 0 ? currentIdx : 0, -1)
            if (next >= 0) this.selectedId = this._items[next].id
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (currentIdx >= 0 && !this._items[currentIdx].disabled) {
                this.emit('select', { id: this._items[currentIdx].id })
            }
        }
    }

    private render(): void {
        const title = this.menuTitle
        const subtitle = this.subtitle
        const selected = this.selectedId
        const headerParts: string[] = []
        if (title) headerParts.push(`<gc-eyebrow class="gc-main-menu-eyebrow">Main Menu</gc-eyebrow>`)
        if (title) headerParts.push(`<gc-title class="gc-main-menu-title">${this.escape(title)}</gc-title>`)
        if (subtitle) headerParts.push(`<div class="gc-main-menu-subtitle">${this.escape(subtitle)}</div>`)
        const headerMarkup = headerParts.length
            ? `<div class="gc-main-menu-header">${headerParts.join('')}</div>`
            : ''

        const itemMarkup = this._items.map((item) => {
            const isSelected = item.id === selected
            const badgeMarkup = item.badge
                ? `<span class="gc-main-menu-badge">${this.escape(item.badge)}</span>`
                : ''
            const caretMarkup = isSelected
                ? `<span class="gc-main-menu-caret">◆</span>`
                : ''
            const disabledAttr = item.disabled ? ' aria-disabled="true"' : ''
            const selectedAttr = isSelected ? ' aria-current="true"' : ''
            const cls = `gc-main-menu-item${isSelected ? ' is-selected' : ''}${item.disabled ? ' is-disabled' : ''}`
            return `<div role="menuitem" class="${cls}" data-id="${this.escape(item.id)}"${disabledAttr}${selectedAttr}>${caretMarkup}<span class="gc-main-menu-label">${this.escape(item.label)}</span>${badgeMarkup}</div>`
        }).join('')

        this.innerHTML = `${headerMarkup}<div class="gc-main-menu-list">${itemMarkup}</div>`

        this.querySelectorAll<HTMLElement>('.gc-main-menu-item').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.id || ''
                const item = this._items.find((i) => i.id === id)
                if (!item || item.disabled) return
                this.selectedId = id
                this.emit('select', { id })
            })
            el.addEventListener('mouseenter', () => {
                const id = el.dataset.id || ''
                const item = this._items.find((i) => i.id === id)
                if (!item || item.disabled) return
                this.selectedId = id
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MainMenu
    }
}

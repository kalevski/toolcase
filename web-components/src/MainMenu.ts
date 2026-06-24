import { esc } from './internal/esc'
const TAG_NAME = 'tc-main-menu'

export interface MainMenuItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

export class MainMenu extends HTMLElement {
    private _initialised = false
    private _items: MainMenuItem[] = []

    /** Optional callback fired alongside `tc-select`. */
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'menu-title', 'subtitle']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'menu')
            if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
            this.render()
            this._initialised = true
        }
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
        this.addEventListener('mouseover', this._onMouseover)
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('mouseover', this._onMouseover)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get items(): MainMenuItem[] {
        return this._items.slice()
    }
    set items(value: MainMenuItem[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
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

    private _select(id: string): void {
        const item = this._items.find((i) => i.id === id)
        if (!item || item.disabled) return
        this.selectedId = id
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _enabledIndex(from: number, dir: 1 | -1): number {
        const n = this._items.length
        if (n === 0) return -1
        let i = from
        for (let step = 0; step < n; step++) {
            i = (i + dir + n) % n
            if (!this._items[i].disabled) return i
        }
        return -1
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const n = this._items.length
        if (n === 0) return
        const currentIdx = this._items.findIndex((i) => i.id === this.selectedId)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = this._enabledIndex(currentIdx >= 0 ? currentIdx : -1, 1)
            if (next >= 0) this.selectedId = this._items[next].id
            return
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            const next = this._enabledIndex(currentIdx >= 0 ? currentIdx : 0, -1)
            if (next >= 0) this.selectedId = this._items[next].id
            return
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (currentIdx >= 0 && !this._items[currentIdx].disabled) {
                this._select(this._items[currentIdx].id)
            }
        }
    }

    private _onClick = (e: Event): void => {
        const target = e.target as Element | null
        const row = target?.closest<HTMLElement>('[data-id]')
        if (!row || !this.contains(row)) return
        const id = row.dataset.id
        if (id != null) this._select(id)
    }

    // Hover-to-highlight: mirrors gc-main-menu's mouseenter-per-item behavior.
    // Re-renders only when the highlighted item actually changes.
    private _onMouseover = (e: Event): void => {
        const target = e.target as Element | null
        const row = target?.closest<HTMLElement>('[data-id]')
        if (!row || !this.contains(row)) return
        const id = row.dataset.id
        if (!id || id === this.selectedId) return
        const found = this._items.find((i) => i.id === id)
        if (!found || found.disabled) return
        this.selectedId = id
    }

    private render(): void {
        const title = this.menuTitle
        const subtitle = this.subtitle
        const selected = this.selectedId

        const headerParts: string[] = []
        if (title) {
            headerParts.push(`<span class="tc-main-menu-eyebrow">Main Menu</span>`)
            headerParts.push(`<span class="tc-main-menu-title">${esc(title)}</span>`)
        }
        if (subtitle) {
            headerParts.push(`<div class="tc-main-menu-subtitle">${esc(subtitle)}</div>`)
        }
        const headerHtml = headerParts.length
            ? `<div class="tc-main-menu-header">${headerParts.join('')}</div>`
            : ''

        const itemsHtml = this._items
            .map((item) => {
                const isSelected = item.id === selected
                const cls = [
                    'tc-main-menu-item',
                    isSelected ? 'tc-main-menu-item--selected' : '',
                    item.disabled ? 'tc-main-menu-item--disabled' : '',
                ]
                    .filter(Boolean)
                    .join(' ')
                const badgeHtml = item.badge
                    ? `<span class="tc-main-menu-badge">${esc(item.badge)}</span>`
                    : ''
                return (
                    `<div` +
                    ` role="menuitem"` +
                    ` class="${cls}"` +
                    ` data-id="${esc(item.id)}"` +
                    (item.disabled ? ` aria-disabled="true"` : '') +
                    (isSelected ? ` aria-current="true"` : '') +
                    `>` +
                    `<span class="tc-main-menu-item-label">${esc(item.label)}</span>` +
                    badgeHtml +
                    `</div>`
                )
            })
            .join('')

        this.innerHTML = `${headerHtml}<div class="tc-main-menu-list">${itemsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MainMenu
    }
}

import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-list'

export interface ListItem {
    id: string
    label?: string
    icon?: string
    meta?: string
    disabled?: boolean
}

function resolveIcon(raw: string): string {
    const svg = lucideByName(raw)
    if (svg) return `<span class="tc-list-item-icon">${svg}</span>`
    return `<span class="tc-list-item-icon tc-list-item-icon--text" aria-hidden="true">${esc(raw)}</span>`
}

export class List extends HTMLElement {
    private _initialised = false
    private _items: ListItem[] = []

    /** Optional callback fired alongside the `tc-select` CustomEvent. */
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
            this.render()
            this._initialised = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get items(): ListItem[] {
        return this._items.slice()
    }
    set items(value: ListItem[]) {
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

    private _onClick = (e: Event): void => {
        const target = e.target as Element | null
        const row = target?.closest<HTMLElement>('[role="option"]')
        if (!row || !this.contains(row)) return
        const id = row.dataset.id
        if (id != null) this._select(id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element | null
        const row = target?.closest<HTMLElement>('[role="option"]')
        if (!row || !this.contains(row)) return

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const id = row.dataset.id
            if (id != null) this._select(id)
            return
        }

        const options = Array.from(
            this.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
        )
        const idx = options.indexOf(row)
        if (idx === -1) return

        let next = -1
        if (e.key === 'ArrowDown') next = Math.min(idx + 1, options.length - 1)
        else if (e.key === 'ArrowUp') next = Math.max(idx - 1, 0)
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = options.length - 1

        if (next !== -1) {
            e.preventDefault()
            options[next].focus()
        }
    }

    private render(): void {
        const selected = this.selectedId

        const itemsHtml = this._items
            .map((item) => {
                const isSelected = item.id === selected
                const cls = [
                    'tc-list-item',
                    isSelected ? 'tc-list-item--selected' : '',
                    item.disabled ? 'tc-list-item--disabled' : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                const iconHtml = item.icon ? resolveIcon(item.icon) : ''
                const labelHtml =
                    item.label != null
                        ? `<span class="tc-list-item-label">${esc(item.label)}</span>`
                        : ''
                const metaHtml =
                    item.meta != null
                        ? `<span class="tc-list-item-meta">${esc(item.meta)}</span>`
                        : ''

                return (
                    `<div` +
                    ` class="${cls}"` +
                    ` role="option"` +
                    ` aria-selected="${isSelected}"` +
                    (item.disabled ? ' aria-disabled="true"' : '') +
                    ` tabindex="${item.disabled ? '-1' : '0'}"` +
                    ` data-id="${esc(item.id)}"` +
                    `>` +
                    iconHtml +
                    `<span class="tc-list-item-body">${labelHtml}${metaHtml}</span>` +
                    `</div>`
                )
            })
            .join('')

        this.innerHTML = `<div class="tc-list">${itemsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: List
    }
}

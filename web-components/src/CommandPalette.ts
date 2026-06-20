import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'
import { lockBody, unlockBody } from './internal/scroll-lock'
import { overlayStack } from './internal/overlay-stack'

const TAG_NAME = 'tc-command-palette'

const DEFAULT_PLACEHOLDER = 'Type a command or search…'

let _idCounter = 0

export interface CommandPaletteItem {
    id: string
    label: string
    group?: string
    icon?: string
    shortcut?: string
    keywords?: string[]
}

const searchIconHtml = lucideByName('search')

interface PaletteGroup {
    group: string
    items: CommandPaletteItem[]
}

export class CommandPalette extends HTMLElement {
    private _initialised = false
    private _items: CommandPaletteItem[] = []
    private _query = ''
    private _highlighted = 0
    private _previousFocus: Element | null = null
    private _keydownAttached = false
    private _idPrefix: string

    onClose: (() => void) | null = null
    onSelect: ((item: CommandPaletteItem) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-command-palette-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'placeholder', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Host-level delegation persists for the element's lifetime; it only
        // does anything while the palette is open (closed → no markup).
        this._detachHostHandlers()
        this._attachHostHandlers()
        if (this.open) this._openSideEffects()
    }

    disconnectedCallback(): void {
        this._detachHostHandlers()
        this._detachKeydown()
        this._restoreScroll()
        overlayStack.pop(this)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            if (this.open) {
                this._query = ''
                this._highlighted = 0
                this.render()
                this._openSideEffects()
            } else {
                this._closeSideEffects()
                this.render()
            }
            return
        }

        // placeholder / loading — re-render only matters while visible.
        if (this.open) this.render()
    }

    // ── Props ──────────────────────────────────────────────────────────────────

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? DEFAULT_PLACEHOLDER
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get items(): CommandPaletteItem[] {
        return this._items
    }
    set items(v: CommandPaletteItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised && this.open) {
            this._highlighted = 0
            this.render()
        }
    }

    // ── Filtering / grouping ─────────────────────────────────────────────────────

    private _matches(item: CommandPaletteItem, query: string): boolean {
        if (!query) return true
        const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase()
        return query.split(/\s+/).every((word) => haystack.includes(word))
    }

    private _computeView(): { groups: PaletteGroup[]; flat: CommandPaletteItem[] } {
        const q = this._query.trim().toLowerCase()
        const filtered = this._items.filter((it) => this._matches(it, q))
        const groups: PaletteGroup[] = []
        const seen = new Map<string, number>()
        filtered.forEach((it) => {
            const g = it.group ?? ''
            if (!seen.has(g)) {
                seen.set(g, groups.length)
                groups.push({ group: g, items: [] })
            }
            groups[seen.get(g)!].items.push(it)
        })
        const flat = groups.flatMap((g) => g.items)
        return { groups, flat }
    }

    // ── Side effects (open/close lifecycle) ───────────────────────────────────────

    private _openSideEffects(): void {
        overlayStack.push(this)
        this._previousFocus = document.activeElement
        this._lockScroll()
        this._attachKeydown()
        requestAnimationFrame(() => {
            if (!this.open) return
            this.querySelector<HTMLInputElement>('.tc-command-palette-input')?.focus()
        })
    }

    private _closeSideEffects(): void {
        overlayStack.pop(this)
        this._detachKeydown()
        this._restoreScroll()
        this._restoreFocus()
    }

    private _lockScroll(): void {
        lockBody()
    }

    private _restoreScroll(): void {
        unlockBody()
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) this._previousFocus.focus()
        this._previousFocus = null
    }

    private _requestClose(): void {
        this.dispatchEvent(
            new CustomEvent('tc-close', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onClose === 'function') this.onClose()
    }

    private _selectItem(flatIdx: number): void {
        const { flat } = this._computeView()
        const item = flat[flatIdx]
        if (!item) return
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { item },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(item)
        this._requestClose()
    }

    // ── Highlight (surgical, no full re-render) ───────────────────────────────────

    private _setHighlight(idx: number): void {
        this._highlighted = idx
        const list = this.querySelector('.tc-command-palette-list')
        if (!list) return
        list.querySelectorAll<HTMLElement>('.tc-command-palette-item').forEach((el) => {
            const isActive = el.getAttribute('data-idx') === String(idx)
            el.classList.toggle('tc-command-palette-item--active', isActive)
            el.setAttribute('aria-selected', isActive ? 'true' : 'false')
            if (isActive) el.scrollIntoView({ block: 'nearest' })
        })
        this._updateActiveDescendant()
    }

    private _updateActiveDescendant(): void {
        const input = this.querySelector('.tc-command-palette-input')
        if (!input) return
        const active = this.querySelector<HTMLElement>(
            `.tc-command-palette-item[data-idx="${this._highlighted}"]`,
        )
        if (active) input.setAttribute('aria-activedescendant', active.id)
        else input.removeAttribute('aria-activedescendant')
    }

    // ── Handlers ───────────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element
        const itemEl = target.closest('.tc-command-palette-item')
        if (itemEl) {
            this._selectItem(parseInt(itemEl.getAttribute('data-idx') ?? '-1', 10))
            return
        }
        // Backdrop click — target is outside the dialog surface.
        if (!target.closest('.tc-command-palette')) this._requestClose()
    }

    private _onMouseMove = (e: MouseEvent): void => {
        const itemEl = (e.target as Element).closest('.tc-command-palette-item')
        if (!itemEl) return
        const idx = parseInt(itemEl.getAttribute('data-idx') ?? '-1', 10)
        if (idx >= 0 && idx !== this._highlighted) this._setHighlight(idx)
    }

    private _onInput = (e: Event): void => {
        this._query = (e.target as HTMLInputElement).value
        this._highlighted = 0
        this._patchList()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (overlayStack.top() !== this) return
        const { flat } = this._computeView()

        if (e.key === 'Escape') {
            e.preventDefault()
            this._requestClose()
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (flat.length === 0) return
            this._setHighlight((this._highlighted + 1) % flat.length)
            return
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (flat.length === 0) return
            this._setHighlight((this._highlighted - 1 + flat.length) % flat.length)
            return
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            this._selectItem(this._highlighted)
            return
        }
        if (e.key === 'Tab') {
            // Only the search input is focusable inside the dialog — keep focus
            // trapped on it (rows are navigated via aria-activedescendant).
            e.preventDefault()
            this.querySelector<HTMLInputElement>('.tc-command-palette-input')?.focus()
        }
    }

    private _attachHostHandlers(): void {
        this.addEventListener('click', this._onClick)
        this.addEventListener('mousemove', this._onMouseMove)
    }

    private _detachHostHandlers(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('mousemove', this._onMouseMove)
    }

    private _attachKeydown(): void {
        if (this._keydownAttached) return
        document.addEventListener('keydown', this._onKeydown)
        this._keydownAttached = true
    }

    private _detachKeydown(): void {
        if (!this._keydownAttached) return
        document.removeEventListener('keydown', this._onKeydown)
        this._keydownAttached = false
    }

    // ── Render ───────────────────────────────────────────────────────────────────

    private _renderShortcut(shortcut: string): string {
        return shortcut
            .trim()
            .split(/\s+/)
            .map((k) => `<kbd class="tc-command-palette-key">${esc(k)}</kbd>`)
            .join('')
    }

    private _renderListInner(): string {
        const listId = `${this._idPrefix}-list`

        if (this.loading) {
            const rows = Array.from({ length: 5 })
                .map(
                    () =>
                        `<li class="tc-command-palette-skeleton" aria-hidden="true">` +
                        `<span class="tc-command-palette-skeleton-bar"></span>` +
                        `</li>`,
                )
                .join('')
            return rows + `<li class="visually-hidden" role="presentation">Loading…</li>`
        }

        const { groups, flat } = this._computeView()

        if (flat.length === 0) {
            const q = this._query.trim()
            const msg = q ? `No results for “${esc(q)}”` : 'No commands available'
            return `<li class="tc-command-palette-empty" role="presentation">${msg}</li>`
        }

        let idx = 0
        let html = ''
        for (const grp of groups) {
            if (grp.group) {
                html += `<li class="tc-command-palette-group" role="presentation">${esc(grp.group)}</li>`
            }
            for (const item of grp.items) {
                const flatIdx = idx++
                const selected = flatIdx === this._highlighted
                const optId = `${listId}-opt-${flatIdx}`
                const iconHtml = item.icon
                    ? `<span class="tc-command-palette-item-icon" aria-hidden="true">${lucideByName(item.icon)}</span>`
                    : ''
                const shortcutHtml = item.shortcut
                    ? `<span class="tc-command-palette-item-shortcut">${this._renderShortcut(item.shortcut)}</span>`
                    : ''
                html +=
                    `<li class="tc-command-palette-item${selected ? ' tc-command-palette-item--active' : ''}"` +
                    ` role="option" id="${optId}" data-idx="${flatIdx}" aria-selected="${selected ? 'true' : 'false'}">` +
                    iconHtml +
                    `<span class="tc-command-palette-item-label">${esc(item.label)}</span>` +
                    shortcutHtml +
                    `</li>`
            }
        }
        return html
    }

    private _patchList(): void {
        const list = this.querySelector('.tc-command-palette-list')
        if (!list) return
        if (this.loading) list.setAttribute('aria-busy', 'true')
        else list.removeAttribute('aria-busy')
        list.innerHTML = this._renderListInner()
        this._updateActiveDescendant()
    }

    private render(): void {
        if (!this.open) {
            this.innerHTML = ''
            return
        }

        const placeholder = esc(this.placeholder)
        const listId = `${this._idPrefix}-list`
        const inputId = `${this._idPrefix}-input`
        const busyAttr = this.loading ? ' aria-busy="true"' : ''

        this.innerHTML =
            `<div class="tc-command-palette-backdrop">` +
            `<div class="tc-command-palette" role="dialog" aria-modal="true" aria-label="Command palette">` +
            `<div class="tc-command-palette-search">` +
            `<span class="tc-command-palette-search-icon" aria-hidden="true">${searchIconHtml}</span>` +
            `<input id="${inputId}" type="text" class="tc-command-palette-input"` +
            ` role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${listId}"` +
            ` aria-label="Search commands" placeholder="${placeholder}"` +
            ` autocomplete="off" spellcheck="false" value="${esc(this._query)}">` +
            `</div>` +
            `<ul id="${listId}" class="tc-command-palette-list" role="listbox" aria-label="Results"${busyAttr}>` +
            this._renderListInner() +
            `</ul>` +
            `<div class="tc-command-palette-footer" aria-hidden="true">` +
            `<span><kbd class="tc-command-palette-key">↑</kbd><kbd class="tc-command-palette-key">↓</kbd> navigate</span>` +
            `<span><kbd class="tc-command-palette-key">↵</kbd> select</span>` +
            `<span><kbd class="tc-command-palette-key">Esc</kbd> close</span>` +
            `</div>` +
            `</div>` +
            `</div>`

        this.querySelector<HTMLInputElement>('.tc-command-palette-input')?.addEventListener(
            'input',
            this._onInput,
        )
        this._updateActiveDescendant()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CommandPalette
    }
}

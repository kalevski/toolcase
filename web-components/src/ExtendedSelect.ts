import { Search, Check } from 'lucide-static'
import { icon, chevronDownIcon } from './icons'

const TAG_NAME = 'tc-extended-select'

let _idCounter = 0

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Pre-compute at module load — these icons are always in the rendered HTML
const searchIconHtml = icon(Search, 'tc-extended-select__search-icon')
const checkIconHtml = icon(Check, 'tc-extended-select__check-icon')

export interface ExtendedSelectItem {
    key: string
    label: string
    description?: string
}

export class ExtendedSelect extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _listId: string
    private _items: ExtendedSelectItem[] = []
    private _filteredItems: ExtendedSelectItem[] = []
    private _searchQuery = ''
    private _isOpen = false
    private _activeIdx = -1
    private _debounceTimer: ReturnType<typeof setTimeout> | null = null
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keyHandler: ((e: KeyboardEvent) => void) | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'name', 'placeholder', 'search-placeholder', 'no-results-text', 'loading']
    }

    constructor() {
        super()
        const n = ++_idCounter
        this._idPrefix = `tc-es-opt-${n}`
        this._listId = `tc-es-list-${n}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._filteredItems = this._items
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._closeMenu(false)
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer)
            this._debounceTimer = null
        }
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            this._syncValueInDOM(next)
        } else if (name === 'name') {
            const hidden = this.querySelector<HTMLInputElement>('.tc-extended-select__hidden')
            if (hidden) hidden.name = next ?? ''
        } else if (name === 'placeholder') {
            if (!this.value) this._updateTriggerLabel()
        } else if (name === 'search-placeholder') {
            const si = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
            if (si) si.placeholder = next ?? 'Search…'
        } else if (name === 'no-results-text') {
            const el = this.querySelector('.tc-extended-select__no-results')
            if (el) el.textContent = next ?? 'No results'
        } else if (name === 'loading') {
            const isLoading = next !== null
            if (isLoading) {
                this.setAttribute('aria-busy', 'true')
                if (this._isOpen) this._closeMenu(false)
            } else {
                this.removeAttribute('aria-busy')
            }
        }
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Select…'
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get searchPlaceholder(): string {
        return this.getAttribute('search-placeholder') ?? 'Search…'
    }
    set searchPlaceholder(v: string) {
        this.setAttribute('search-placeholder', v)
    }

    get noResultsText(): string {
        return this.getAttribute('no-results-text') ?? 'No results'
    }
    set noResultsText(v: string) {
        this.setAttribute('no-results-text', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get items(): ExtendedSelectItem[] {
        return this._items
    }
    set items(v: ExtendedSelectItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._searchQuery = ''
            this._filteredItems = this._items
            this._activeIdx = -1
            const si = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
            if (si) si.value = ''
            this._renderList()
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private _selectedItem(): ExtendedSelectItem | undefined {
        const v = this.value
        return v ? this._items.find(i => i.key === v) : undefined
    }

    private _triggerLabelHtml(): string {
        const sel = this._selectedItem()
        return sel ? esc(sel.label) : esc(this.placeholder)
    }

    private _updateTriggerLabel(): void {
        const el = this.querySelector('.tc-extended-select__trigger-label')
        if (el) el.innerHTML = this._triggerLabelHtml()
        const trigger = this.querySelector('.tc-extended-select__trigger')
        if (trigger) {
            trigger.classList.toggle('tc-extended-select__trigger--placeholder', !this.value)
        }
    }

    private _syncValueInDOM(newValue: string | null): void {
        const hidden = this.querySelector<HTMLInputElement>('.tc-extended-select__hidden')
        if (hidden) hidden.value = newValue ?? ''
        this._updateTriggerLabel()
        const opts = this.querySelectorAll<HTMLElement>('[role="option"]')
        opts.forEach(opt => {
            const isSelected = opt.dataset.key === (newValue ?? '')
            opt.setAttribute('aria-selected', String(isSelected && !!newValue))
            opt.classList.toggle('tc-extended-select__option--selected', isSelected && !!newValue)
        })
    }

    private _renderOptions(): string {
        const currentValue = this.value
        if (!this._filteredItems.length) {
            return `<li class="tc-extended-select__no-results" role="presentation">${esc(this.noResultsText)}</li>`
        }
        return this._filteredItems.map((item, idx) => {
            const isSelected = !!currentValue && item.key === currentValue
            const isActive = idx === this._activeIdx
            let cls = 'tc-extended-select__option'
            if (isSelected) cls += ' tc-extended-select__option--selected'
            if (isActive) cls += ' tc-extended-select__option--active'
            const descHtml = item.description
                ? `<span class="tc-extended-select__option-desc">${esc(item.description)}</span>`
                : ''
            const checkHtml = isSelected
                ? `<span class="tc-extended-select__check" aria-hidden="true">${checkIconHtml}</span>`
                : ''
            // check appears before description so it stays on the label's row (flex-wrap layout)
            return `<li class="${cls}" role="option" aria-selected="${isSelected}" id="${this._idPrefix}-${idx}" data-key="${esc(item.key)}" tabindex="-1"><span class="tc-extended-select__option-label">${esc(item.label)}</span>${checkHtml}${descHtml}</li>`
        }).join('')
    }

    private _renderList(): void {
        const listEl = this.querySelector('.tc-extended-select__list')
        if (!listEl) return
        listEl.innerHTML = this._renderOptions()
        this._updateActiveDescendant()
    }

    private render(): void {
        const currentValue = this.value
        const isPlaceholder = !currentValue
        const triggerCls = `tc-extended-select__trigger${isPlaceholder ? ' tc-extended-select__trigger--placeholder' : ''}`

        this.innerHTML = `<input type="hidden" name="${esc(this.name)}" value="${esc(currentValue)}" class="tc-extended-select__hidden"><button type="button" class="${triggerCls}" role="combobox" aria-expanded="false" aria-controls="${this._listId}" aria-haspopup="listbox"><span class="tc-extended-select__trigger-label">${this._triggerLabelHtml()}</span><span class="tc-extended-select__trigger-spinner" aria-hidden="true"><span class="spinner-border spinner-border-sm"></span></span><span class="tc-extended-select__caret" aria-hidden="true">${chevronDownIcon}</span></button><div class="tc-extended-select__menu"><div class="tc-extended-select__search-wrap">${searchIconHtml}<input type="text" class="tc-extended-select__search-input" placeholder="${esc(this.searchPlaceholder)}" autocomplete="off" aria-label="Search options"></div><ul class="tc-extended-select__list" id="${this._listId}" role="listbox">${this._renderOptions()}</ul><div class="tc-extended-select__loading-indicator" aria-live="polite" aria-label="Loading"><span class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading…</span></span></div></div>`

        if (this.loading) this.setAttribute('aria-busy', 'true')

        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
        if (trigger) trigger.addEventListener('click', this._onTriggerClick)

        const searchInput = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
        if (searchInput) searchInput.addEventListener('input', this._onSearchInput)

        const list = this.querySelector('.tc-extended-select__list')
        if (list) {
            list.addEventListener('click', this._onListClick)
            list.addEventListener('mouseover', this._onListMouseOver)
        }
    }

    // ── Open / Close ─────────────────────────────────────────────────────────

    private _openMenu(): void {
        if (this._isOpen || this.loading) return
        this._isOpen = true

        const menu = this.querySelector('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')

        if (menu) menu.classList.add('tc-extended-select__menu--open')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')

        // Pre-highlight selected item
        const v = this.value
        if (v) {
            const idx = this._filteredItems.findIndex(i => i.key === v)
            if (idx !== -1) {
                this._activeIdx = idx
                this._setActiveClass()
            }
        }

        // Focus search input
        const si = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
        if (si) si.focus()

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu()
        }
        document.addEventListener('mousedown', this._outsideHandler)

        this._keyHandler = (e: KeyboardEvent) => this._onKeyDown(e)
        document.addEventListener('keydown', this._keyHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._activeIdx = -1

        const menu = this.querySelector('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')

        if (menu) menu.classList.remove('tc-extended-select__menu--open')
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false')
            trigger.removeAttribute('aria-activedescendant')
        }

        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler)
            this._keyHandler = null
        }

        // Clear search and reset list
        const si = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
        if (si) si.value = ''
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer)
            this._debounceTimer = null
        }
        this._searchQuery = ''
        this._filteredItems = this._items
        this._renderList()

        if (refocus) {
            this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')?.focus()
        }
    }

    // ── Active option tracking ────────────────────────────────────────────────

    private _setActive(idx: number): void {
        this._activeIdx = idx
        this._setActiveClass()
        this._updateActiveDescendant()
        if (idx >= 0) {
            const opt = this.querySelector(`#${this._idPrefix}-${idx}`)
            opt?.scrollIntoView({ block: 'nearest' })
        }
    }

    private _setActiveClass(): void {
        const prev = this.querySelector('.tc-extended-select__option--active')
        if (prev) prev.classList.remove('tc-extended-select__option--active')
        if (this._activeIdx >= 0) {
            const opt = this.querySelector(`#${this._idPrefix}-${this._activeIdx}`)
            if (opt) opt.classList.add('tc-extended-select__option--active')
        }
    }

    private _updateActiveDescendant(): void {
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
        if (!trigger) return
        if (this._activeIdx >= 0) {
            trigger.setAttribute('aria-activedescendant', `${this._idPrefix}-${this._activeIdx}`)
        } else {
            trigger.removeAttribute('aria-activedescendant')
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    private _selectItem(key: string): void {
        this.value = key
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value: key },
        }))
        if (typeof this.onChange === 'function') this.onChange(key)
        this._closeMenu()
    }

    // ── Search ────────────────────────────────────────────────────────────────

    private _onSearchInput = (): void => {
        const si = this.querySelector<HTMLInputElement>('.tc-extended-select__search-input')
        const query = si?.value ?? ''
        if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null
            this._searchQuery = query
            const q = query.toLowerCase().trim()
            if (!q) {
                this._filteredItems = this._items
            } else {
                this._filteredItems = this._items.filter(item =>
                    item.label.toLowerCase().includes(q) ||
                    (item.description ?? '').toLowerCase().includes(q)
                )
            }
            this._activeIdx = -1
            this._renderList()
        }, 150)
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onTriggerClick = (): void => {
        if (this._isOpen) this._closeMenu()
        else this._openMenu()
    }

    private _onListClick = (e: MouseEvent): void => {
        const opt = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]')
        if (!opt) return
        const key = opt.dataset.key
        if (key) this._selectItem(key)
    }

    private _onListMouseOver = (e: MouseEvent): void => {
        const opt = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]')
        if (!opt || !opt.id.startsWith(this._idPrefix)) return
        const idx = parseInt(opt.id.slice(this._idPrefix.length + 1), 10)
        if (!isNaN(idx) && idx !== this._activeIdx) this._setActive(idx)
    }

    private _onKeyDown(e: KeyboardEvent): void {
        if (!this._isOpen) return
        const count = this._filteredItems.length

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault()
                if (!count) break
                this._setActive(this._activeIdx < count - 1 ? this._activeIdx + 1 : 0)
                break
            }
            case 'ArrowUp': {
                e.preventDefault()
                if (!count) break
                this._setActive(this._activeIdx > 0 ? this._activeIdx - 1 : count - 1)
                break
            }
            case 'Home': {
                e.preventDefault()
                if (count) this._setActive(0)
                break
            }
            case 'End': {
                e.preventDefault()
                if (count) this._setActive(count - 1)
                break
            }
            case 'Enter': {
                e.preventDefault()
                if (this._activeIdx >= 0 && this._activeIdx < count) {
                    this._selectItem(this._filteredItems[this._activeIdx].key)
                }
                break
            }
            case 'Escape': {
                e.preventDefault()
                this._closeMenu()
                break
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ExtendedSelect
    }
}

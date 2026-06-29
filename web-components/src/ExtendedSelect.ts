import { esc } from './internal/esc'
import { Search, Check } from 'lucide-static'
import { icon, chevronDownIcon } from './icons'
import { fixedContainingBlock } from './internal/containingBlock'
import { cssLength } from './internal/cssLength'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'

const TAG_NAME = 'tc-extended-select'

let _idCounter = 0

export type ExtendedSelectState = 'valid' | 'invalid'

const STATES: ExtendedSelectState[] = ['valid', 'invalid']

// Pre-compute at module load — these icons are always in the rendered HTML
const searchIconHtml = icon(Search, 'tc-extended-select__search-icon')
const checkIconHtml = icon(Check, 'tc-extended-select__check-icon')

export interface ExtendedSelectItem {
    key: string
    label: string
    description?: string
}

export class ExtendedSelect extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _idPrefix: string
    private _listId: string
    private _helpId: string
    private _items: ExtendedSelectItem[] = []
    private _filteredItems: ExtendedSelectItem[] = []
    private _searchQuery = ''
    private _isOpen = false
    private _activeIdx = -1
    private _debounceTimer: ReturnType<typeof setTimeout> | null = null
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keyHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null
    private _internals: ElementInternals
    private _defaultValue = ''
    // The ancestor (if any) that establishes the menu's containing block while
    // open — see _containingBlock(). Cached on open; the menu's fixed coords are
    // resolved against this box, not the viewport, when it is non-null.
    private _cbEl: HTMLElement | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'name',
            'placeholder',
            'search-placeholder',
            'no-results-text',
            'loading',
            'disabled',
            'required',
            'max-height',
            'label',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        const n = ++_idCounter
        this._idPrefix = `tc-es-opt-${n}`
        this._listId = `tc-es-list-${n}`
        // Stable id for the reserved message slot (trigger aria-describedby).
        this._helpId = `tc-es-help-${n}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
            this._filteredItems = this._items
            this.render()
            this._initialised = true
        }
        this._applyMaxHeight()
        this._syncForm()
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
            this._syncForm()
        } else if (name === 'name') {
            // The hidden input no longer submits (its name is cleared in render),
            // but keep its name attribute in sync for any external querying; the
            // canonical submission value flows through ElementInternals below.
            const hidden = this.querySelector<HTMLInputElement>('.tc-extended-select__hidden')
            if (hidden) hidden.name = next ?? ''
            this._syncForm()
        } else if (name === 'required') {
            const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
            if (trigger) {
                if (this.required) trigger.setAttribute('aria-required', 'true')
                else trigger.removeAttribute('aria-required')
            }
            this._patchValidation()
            this._syncForm()
        } else if (name === 'disabled') {
            const isDisabled = this.disabled
            const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
            if (trigger) trigger.disabled = isDisabled
            // A disabled control must not keep an open menu around.
            if (isDisabled && this._isOpen) this._closeMenu(false)
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
        } else if (name === 'max-height') {
            this._applyMaxHeight()
        } else if (name === 'label' || name === 'help' || name === 'error' || name === 'state') {
            // Patch the reserved slot, the label, and the trigger's invalid
            // border in place. A full render() would tear down the menu and drop
            // its anchoring / focus, so we touch only the affected nodes.
            this._patchValidation()
            // error/state change the effective validity → reflect into the form.
            this._syncForm()
        }
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue
        this._syncValueInDOM(this._defaultValue)
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /**
     * Push value + validity into the form. Effective invalid = error / state
     * invalid / required-but-empty. Mirrors the shared form-field contract.
     */
    private _syncForm(): void {
        const value = this.value
        setFieldFormValue(this._internals, this.name || null, value === '' ? null : value)
        const error = this.error
        const requiredEmpty = this.required && value === ''
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message:
                error ||
                (requiredEmpty ? 'Please make a selection.' : 'Please provide a valid selection.'),
            anchor:
                this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger') ?? undefined,
        })
    }

    /**
     * Cap how tall the options list grows before it scrolls. A bare number is
     * read as pixels; any CSS length (`50vh`, `20rem`, …) is honoured as-is.
     * Removing the attribute restores the stylesheet default (240px).
     */
    private _applyMaxHeight(): void {
        const h = cssLength(this.getAttribute('max-height'))
        if (h) this.style.setProperty('--bs-extended-select-list-max-height', h)
        else this.style.removeProperty('--bs-extended-select-list-max-height')
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

    // ── disabled ─────────────────────────────────────────────────────────────
    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── required ─────────────────────────────────────────────────────────────
    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get maxHeight(): string {
        return this.getAttribute('max-height') ?? ''
    }
    set maxHeight(v: string) {
        if (v) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    get state(): ExtendedSelectState | null {
        const v = this.getAttribute('state') as ExtendedSelectState
        return STATES.includes(v) ? v : null
    }
    set state(v: ExtendedSelectState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
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
        return v ? this._items.find((i) => i.key === v) : undefined
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
        opts.forEach((opt) => {
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
        return this._filteredItems
            .map((item, idx) => {
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
            })
            .join('')
    }

    private _renderList(): void {
        const listEl = this.querySelector('.tc-extended-select__list')
        if (!listEl) return
        listEl.innerHTML = this._renderOptions()
        this._updateActiveDescendant()
        // Filtering changes the menu height; re-anchor so a flipped-up menu
        // stays attached to the trigger instead of drifting.
        if (this._isOpen) this._positionMenu()
    }

    // Effective validity: a non-empty `error` forces invalid, else honour `state`.
    private _effectiveState(): ExtendedSelectState | null {
        return this.error ? 'invalid' : this.state
    }

    private render(): void {
        const currentValue = this.value
        const isPlaceholder = !currentValue
        const state = this._effectiveState()
        const invalidCls = state === 'invalid' ? ' tc-extended-select__trigger--invalid' : ''
        const triggerCls = `tc-extended-select__trigger${isPlaceholder ? ' tc-extended-select__trigger--placeholder' : ''}${invalidCls}`

        const required = this.required
        const disabled = this.disabled
        const label = this.label
        const labelHtml = label
            ? `<label class="form-label tc-extended-select__label">${esc(label)}${requiredMark(required)}</label>`
            : ''

        // Describe the trigger by the reserved slot only when it carries content.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''
        // aria-required surfaces the requirement on the focusable trigger.
        const requiredAttr = required ? ' aria-required="true"' : ''
        const disabledAttr = disabled ? ' disabled' : ''

        // Reserved message slot — plain block flow as the LAST host child, after
        // the trigger and the (fixed-positioned) menu. Kept outside the menu so
        // it never inherits the menu's overflow/fixed positioning and stays
        // visible beneath the control.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error: this.error,
            hint: this.help,
            invalidText: 'Please provide a valid selection.',
            validText: 'Looks good!',
        })

        // The hidden input mirrors the value in the DOM (read by _syncValueInDOM)
        // but no longer submits — form submission flows through ElementInternals
        // (_syncForm) so the value is not duplicated under `name`. Its `name`
        // attribute is therefore intentionally omitted.
        this.innerHTML = `${labelHtml}<input type="hidden" value="${esc(currentValue)}" class="tc-extended-select__hidden"><button type="button" class="${triggerCls}" role="combobox" aria-expanded="false" aria-controls="${this._listId}" aria-haspopup="listbox"${describe}${requiredAttr}${disabledAttr}><span class="tc-extended-select__trigger-label">${this._triggerLabelHtml()}</span><span class="tc-extended-select__trigger-spinner" aria-hidden="true"><span class="spinner-border spinner-border-sm"></span></span><span class="tc-extended-select__caret" aria-hidden="true">${chevronDownIcon}</span></button><div class="tc-extended-select__menu"><div class="tc-extended-select__search-wrap">${searchIconHtml}<input type="text" class="tc-extended-select__search-input" placeholder="${esc(this.searchPlaceholder)}" autocomplete="off" aria-label="Search options"></div><ul class="tc-extended-select__list" id="${this._listId}" role="listbox">${this._renderOptions()}</ul><div class="tc-extended-select__loading-indicator" aria-live="polite" aria-label="Loading"><span class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading…</span></span></div></div>${messageHtml}`

        if (this.loading) this.setAttribute('aria-busy', 'true')

        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
        if (trigger) trigger.addEventListener('click', this._onTriggerClick)

        const searchInput = this.querySelector<HTMLInputElement>(
            '.tc-extended-select__search-input',
        )
        if (searchInput) searchInput.addEventListener('input', this._onSearchInput)

        const list = this.querySelector<HTMLElement>('.tc-extended-select__list')
        if (list) {
            list.addEventListener('click', this._onListClick)
            list.addEventListener('mouseover', this._onListMouseOver)
        }
    }

    /**
     * Patch the label, the trigger's invalid border + aria-describedby, and the
     * reserved message slot in place — leaving the menu (and its anchoring /
     * focus) untouched. Used for label/help/error/state attribute changes.
     */
    private _patchValidation(): void {
        const state = this._effectiveState()

        // Slot — outerHTML keeps the single .tc-field-message contract.
        const slot = this.querySelector<HTMLElement>('.tc-field-message')
        if (slot) {
            slot.outerHTML = fieldMessageHtml({
                id: this._helpId,
                state,
                error: this.error,
                hint: this.help,
                invalidText: 'Please provide a valid selection.',
                validText: 'Looks good!',
            })
        }

        // Trigger invalid border + describedby.
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
        if (trigger) {
            trigger.classList.toggle('tc-extended-select__trigger--invalid', state === 'invalid')
            if (this.help || state) trigger.setAttribute('aria-describedby', this._helpId)
            else trigger.removeAttribute('aria-describedby')
        }

        // Label — insert / update / remove as the first host child.
        const label = this.label
        const labelEl = this.querySelector<HTMLLabelElement>('.tc-extended-select__label')
        if (label) {
            if (labelEl) {
                labelEl.textContent = label
            } else {
                this.insertAdjacentHTML(
                    'afterbegin',
                    `<label class="form-label tc-extended-select__label">${esc(label)}</label>`,
                )
            }
        } else if (labelEl) {
            labelEl.remove()
        }
    }

    // ── Open / Close ─────────────────────────────────────────────────────────

    private _openMenu(): void {
        if (this._isOpen || this.loading || this.disabled) return
        this._isOpen = true

        const menu = this.querySelector('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')

        if (menu) menu.classList.add('tc-extended-select__menu--open')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')

        // Anchor the fixed-positioned menu to the trigger (escapes overflow
        // clipping from ancestor scroll containers), then keep it anchored
        // while the page or an ancestor scrolls/resizes underneath it.
        this._cbEl = fixedContainingBlock(this)
        this._positionMenu()
        this._repositionHandler = () => this._positionMenu()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)

        // Pre-highlight selected item
        const v = this.value
        if (v) {
            const idx = this._filteredItems.findIndex((i) => i.key === v)
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
        if (this._repositionHandler) {
            window.removeEventListener('scroll', this._repositionHandler, true)
            window.removeEventListener('resize', this._repositionHandler)
            this._repositionHandler = null
        }
        this._cbEl = null

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

    /**
     * Position the fixed menu against the trigger in viewport coordinates.
     * Width matches the trigger; the menu opens below by default and flips
     * above when there isn't room beneath it. Left/top are clamped so the
     * panel never spills off-screen.
     *
     * When an ancestor establishes a containing block (see _containingBlock),
     * `position: fixed` is resolved against that ancestor's box rather than the
     * viewport, so the viewport coordinates are converted into its local frame
     * before being written — otherwise the menu drifts by the ancestor's offset.
     */
    private _positionMenu(): void {
        const menu = this.querySelector<HTMLElement>('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLElement>('.tc-extended-select__trigger')
        if (!menu || !trigger) return

        const gap = 2
        const margin = 4 // keep a small breathing gap from viewport edges
        const r = trigger.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        menu.style.width = `${r.width}px`

        // Measure after width is applied; menu is laid out (visibility:hidden)
        // even before the --open class, so offsetHeight is reliable here.
        const menuH = menu.offsetHeight
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < menuH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - menuH - gap)
            : Math.min(r.bottom + gap, vh - menuH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - r.width - margin))
        top = Math.max(margin, top)

        // Re-base the viewport coords onto the containing block's frame when a
        // transformed/filtered/contained ancestor has hijacked `fixed`.
        if (this._cbEl) {
            const cb = this._cbEl.getBoundingClientRect()
            top -= cb.top
            left -= cb.left
        }

        menu.style.top = `${top}px`
        menu.style.left = `${left}px`
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
        // Push the new selection into the form before announcing it.
        this._syncForm()
        // Canonical change event — detail is exactly { value }.
        dispatchFieldChange(this, key)
        this.dispatchEvent(new Event('change', { bubbles: true }))
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
                this._filteredItems = this._items.filter(
                    (item) =>
                        item.label.toLowerCase().includes(q) ||
                        (item.description ?? '').toLowerCase().includes(q),
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

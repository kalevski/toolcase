import { esc } from './internal/esc'
import { msg, msgFormat } from './messages'
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

import type { BottomSheet } from './BottomSheet'

const TAG_NAME = 'tc-extended-select'

let _idCounter = 0

export type ExtendedSelectState = 'valid' | 'invalid'

const STATES: ExtendedSelectState[] = ['valid', 'invalid']

/**
 * How the option list is presented on a touch device.
 *
 *   `auto`      — a bottom sheet under a coarse pointer below 768px, the floating
 *                 dropdown everywhere else. The default.
 *   `sheet`     — always the sheet.
 *   `dropdown`  — always the dropdown (the pre-5.2 behaviour).
 */
export type ExtendedSelectMobile = 'auto' | 'sheet' | 'dropdown'

const MOBILE_MODES: ExtendedSelectMobile[] = ['auto', 'sheet', 'dropdown']

// WHY A SHEET AND NOT A DROPDOWN ON A PHONE.
//   A floating menu is anchored to its trigger, capped at 240px, and positioned
//   against a 844px-tall viewport that the software keyboard then halves. With the
//   ingredient-category filter's ~60 options — never mind a 300-option list — the
//   result is a 240px window scrolling inside a page that is itself scrolling,
//   somewhere near the middle of the screen, with rows a thumb covers entirely.
//   The bottom sheet is the shape every mobile OS settled on for the same problem:
//   thumb-side, full-width rows, one scroller, a scrim that cannot be mis-tapped.
//
// THIS IS A PRESENTATION CHANGE ONLY. The value, the selection logic, the search
// filter, the form participation and every event are the same code in both modes —
// the sheet is a different PLACE to put `.tc-extended-select__menu`, not a second
// implementation of it.
const SHEET_MEDIA = '(pointer: coarse) and (max-width: 767.98px)'

/**
 * Below this many options the sheet hides its search field: a filter that is
 * slower to read than the list it filters is noise, and on a phone it also costs
 * the keyboard covering half the sheet. 12 rows is roughly what fits above the
 * fold of an `auto`-height sheet.
 */
const SHEET_SEARCH_THRESHOLD = 12

// Pre-compute at module load — these icons are always in the rendered HTML
const searchIconHtml = icon(Search, 'tc-extended-select__search-icon')
const checkIconHtml = icon(Check, 'tc-extended-select__check-icon')

export interface ExtendedSelectItem {
    key: string
    label: string
    description?: string
    /** Extra search terms the menu's search field matches but never renders.
     *  Same contract as `ComboOption.keywords`: the visible label is not always
     *  the only spelling a user types — a transliteration, an abbreviation, a
     *  synonym or an English alias belongs here rather than in `description`,
     *  which is shown under the label. */
    keywords?: string[]
}

// Multi-select: how many picked labels are listed in the trigger before it
// collapses to the "{count} selected" summary.
const SUMMARY_THRESHOLD = 3

/** Split the comma-separated `value` attribute into unique, non-empty keys. */
function parseKeys(raw: string | null): string[] {
    if (!raw) return []
    const out: string[] = []
    for (const part of raw.split(',')) {
        const key = part.trim()
        if (key && !out.includes(key)) out.push(key)
    }
    return out
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
    // The sheet that hosts the menu under a coarse pointer. Created on first sheet
    // open, kept for the element's lifetime (it holds the menu), mounted only while
    // open. Null in dropdown mode, and null when tc-bottom-sheet is not registered.
    private _sheet: BottomSheet | null = null
    // Set while _closeMenu is the one asking the sheet to close, so the sheet's own
    // `tc-sheet-close` (scrim tap, drag, Escape) does not re-enter it.
    private _closingSheet = false

    // Single mode hands the callback the selected key; `multiple` hands it the
    // full key array. Declared as a union so existing single-mode handlers keep
    // type-checking.
    onChange: ((value: string) => void) | ((value: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'multiple',
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
            'mobile',
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
        // The sheet lives OUTSIDE this element (in the shell's overlay layer, or at
        // document.body), so nothing removes it when this element goes. Left behind
        // it would be an orphaned dialog holding this select's option list.
        this._sheet?.remove()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            this._syncValueInDOM(next)
            this._syncForm()
        } else if (name === 'multiple') {
            // The option rows and the trigger summary are shaped by the mode —
            // rebuild wholesale. An open menu would be left anchored to a
            // discarded trigger, so it closes first.
            this._closeMenu(false)
            this.render()
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
            const si = this._menuRoot().querySelector<HTMLInputElement>(
                '.tc-extended-select__search-input',
            )
            if (si) si.placeholder = next ?? msg('searchPlaceholder')
        } else if (name === 'no-results-text') {
            const el = this._menuRoot().querySelector('.tc-extended-select__no-results')
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
        // Multi mode submits one entry per key under `name` (array branch of
        // setFieldFormValue); single mode submits the bare key.
        const multiple = this.multiple
        const keys = multiple ? this.values : []
        const value = this.value
        setFieldFormValue(
            this._internals,
            this.name || null,
            multiple ? (keys.length ? keys : null) : value === '' ? null : value,
        )
        const error = this.error
        const requiredEmpty = this.required && (multiple ? keys.length === 0 : value === '')
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('selectionRequired') : msg('selectionInvalid')),
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

    /**
     * The raw value. In single mode this is the selected key; under `multiple`
     * it is the comma-separated list of selected keys (use `values` for the
     * parsed array). Keys must therefore not contain commas in multi mode.
     */
    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    /** Selected keys as an array. Writing it is a no-op guard against non-arrays. */
    get values(): string[] {
        return parseKeys(this.getAttribute('value'))
    }
    set values(v: string[]) {
        if (!Array.isArray(v)) return
        this.value = parseKeys(v.join(',')).join(',')
    }

    /** Toggle multi-selection. The menu stays open while picking and the value
     *  becomes a comma-separated key list. */
    get multiple(): boolean {
        return this.hasAttribute('multiple')
    }
    set multiple(v: boolean) {
        if (v) this.setAttribute('multiple', '')
        else this.removeAttribute('multiple')
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? msg('selectPlaceholder')
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get searchPlaceholder(): string {
        return this.getAttribute('search-placeholder') ?? msg('searchPlaceholder')
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

    /** Presentation of the option list on touch — see `ExtendedSelectMobile`. */
    get mobile(): ExtendedSelectMobile {
        const v = this.getAttribute('mobile') as ExtendedSelectMobile
        return MOBILE_MODES.includes(v) ? v : 'auto'
    }
    set mobile(v: ExtendedSelectMobile) {
        if (v && v !== 'auto') this.setAttribute('mobile', v)
        else this.removeAttribute('mobile')
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
            const si = this._menuRoot().querySelector<HTMLInputElement>(
                '.tc-extended-select__search-input',
            )
            if (si) si.value = ''
            this._renderList()
            // Labels for an already-set value only resolve once items land.
            this._updateTriggerLabel()
        }
    }

    // ── Sheet presentation (coarse pointers) ─────────────────────────────────

    /**
     * Whether this open should use the sheet.
     *
     * The tc-bottom-sheet REGISTRATION CHECK is not defensiveness: this element
     * carries no runtime import on BottomSheet (only a type-only one, which erases),
     * so a consumer who registers a subset of the library still gets a working
     * select — it falls back to the dropdown rather than creating an inert
     * `<tc-bottom-sheet>` that never opens.
     */
    private _sheetMode(): boolean {
        const mode = this.mobile
        if (mode === 'dropdown') return false
        if (typeof customElements === 'undefined' || !customElements.get('tc-bottom-sheet')) {
            return false
        }
        if (mode === 'sheet') return true
        return typeof matchMedia === 'function' && matchMedia(SHEET_MEDIA).matches
    }

    /**
     * The node that currently CONTAINS the menu markup — the host in dropdown mode,
     * the sheet in sheet mode. Every menu-internal lookup goes through this, because
     * in sheet mode the menu is no longer a descendant of the host. Lookups for the
     * trigger, the label, the hidden input and the message slot stay on `this`.
     */
    private _menuRoot(): ParentNode {
        // ASKED, not assumed. `render()` rebuilds the host's innerHTML — a fresh menu
        // in the host, and the sheet holding nothing — so "a sheet exists" is not the
        // same question as "the sheet has the menu". Answering it by lookup makes this
        // self-correcting across a re-render, a mode switch and a rotation alike.
        const sheet = this._sheet
        if (sheet?.querySelector('.tc-extended-select__menu')) return sheet
        return this
    }

    /**
     * Where the sheet mounts, in preference order.
     *
     *   1. The shell's overlay layer. That layer is the frame's own stacking context,
     *      so a sheet there is positioned against the PHONE FRAME rather than the
     *      window — which is what keeps it 390px wide on a tablet — and
     *      tc-bottom-sheet's pane scroll-lock and blur-behind paths only engage for a
     *      sheet outside the pane.
     *   2. The nearest `tc-theme`. Custom properties are inherited, so a sheet
     *      mounted OUTSIDE the theme wrapper loses every `--tc-*` the theme sets and
     *      renders in the un-themed default palette. `tc-theme` is
     *      `display: contents`, so it constrains nothing.
     *   3. `document.body`.
     */
    private _sheetMount(): HTMLElement {
        const shell = this.closest('tc-mobile-shell')
        const overlay = shell?.querySelector<HTMLElement>(':scope > [slot="overlay"]')
        if (overlay) return overlay
        return this.closest<HTMLElement>('tc-theme, [data-tc-theme]') ?? document.body
    }

    private _ensureSheet(): BottomSheet {
        if (this._sheet) return this._sheet
        const sheet = document.createElement('tc-bottom-sheet') as BottomSheet
        sheet.classList.add('tc-extended-select__sheet')
        // `auto` height, so a five-option select is a five-row sheet rather than a
        // half-screen panel; a long list is capped by the sheet's own max-height.
        sheet.setAttribute('snap', 'auto')

        const header = document.createElement('div')
        header.setAttribute('slot', 'header')
        const title = document.createElement('h2')
        title.className = 'tc-sheet-title tc-extended-select__sheet-title'
        header.appendChild(title)
        sheet.appendChild(header)

        const footer = document.createElement('div')
        footer.setAttribute('slot', 'footer')
        footer.className = 'tc-extended-select__sheet-footer'
        sheet.appendChild(footer)

        // A scrim tap, a downward drag and Escape all close the sheet without going
        // through _closeMenu — so the element's own open state has to follow.
        sheet.addEventListener('tc-sheet-close', this._onSheetClose)
        sheet.addEventListener('click', this._onSheetFooterClick)

        this._sheet = sheet
        return sheet
    }

    /** Title, search visibility and footer, refreshed on every sheet open. */
    private _syncSheetChrome(sheet: BottomSheet): void {
        const title = sheet.querySelector<HTMLElement>('.tc-extended-select__sheet-title')
        if (title) title.textContent = this.label || this.placeholder

        // Search past ~12 options only — see SHEET_SEARCH_THRESHOLD.
        if (this._items.length > SHEET_SEARCH_THRESHOLD) sheet.removeAttribute('data-no-search')
        else sheet.setAttribute('data-no-search', '')

        // Multi-select needs an explicit "I am done picking": every tap toggles a row
        // and none of them dismisses, so without a footer the only way out is the
        // scrim — which reads as cancelling.
        const footer = sheet.querySelector<HTMLElement>('.tc-extended-select__sheet-footer')
        if (!footer) return
        if (this.multiple) {
            if (!footer.firstElementChild) {
                footer.innerHTML =
                    `<button type="button" class="btn btn-primary tc-extended-select__sheet-done">` +
                    `${esc(msg('done'))}</button>`
            } else {
                const done = footer.querySelector('.tc-extended-select__sheet-done')
                if (done) done.textContent = msg('done')
            }
        } else {
            footer.innerHTML = ''
        }
    }

    /**
     * Put the menu back where the current mode wants it. Called on every open, so a
     * viewport that crossed 768px (or a rotation) between two opens does not leave
     * the list stranded in a sheet that will never be shown.
     */
    private _placeMenu(useSheet: boolean): void {
        const menu = this._menuRoot().querySelector('.tc-extended-select__menu')
        if (!menu) return
        if (useSheet) {
            const sheet = this._ensureSheet()
            if (menu.parentElement !== sheet) {
                // The menu becomes the sheet's BODY — the one unslotted child, which
                // is what tc-bottom-sheet scrolls and what its nested-drag logic reads
                // scrollTop from. Inserted before the footer so the DOM order reads the
                // way the sheet renders. MOVED, not copied: one list, one set of option
                // ids, one source of truth.
                //
                // This is not the re-parenting hazard documented in src/MobileShell.ts
                // — that one is about moving a CONSUMER's (framework-owned) children.
                // Every node here was created by this element's own render().
                const footer = sheet.querySelector('.tc-extended-select__sheet-footer')
                sheet.insertBefore(menu, footer ?? null)
            }
        } else if (menu.parentElement !== this) {
            // Back to being the trigger's sibling; _positionMenu anchors it again.
            this.appendChild(menu)
        }
    }

    private _onSheetClose = (): void => {
        if (this._closingSheet) return
        // Refocus the trigger: the sheet restores focus to whatever had it before it
        // opened, which IS the trigger — so `false` here, and let the sheet do it.
        this._closeMenu(false)
    }

    private _onSheetFooterClick = (e: Event): void => {
        const target = e.target as HTMLElement | null
        if (!target?.closest('.tc-extended-select__sheet-done')) return
        this._closeMenu()
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Currently selected keys — one entry at most outside `multiple`. */
    private _selectedKeys(): string[] {
        if (this.multiple) return this.values
        const v = this.value
        return v ? [v] : []
    }

    private _selectedItem(): ExtendedSelectItem | undefined {
        const v = this.value
        return v ? this._items.find((i) => i.key === v) : undefined
    }

    private _triggerLabelHtml(): string {
        if (this.multiple) {
            const keys = this.values
            if (!keys.length) return esc(this.placeholder)
            if (keys.length > SUMMARY_THRESHOLD) {
                return esc(msgFormat('selectedCount', { count: keys.length }))
            }
            // Unknown keys (items not loaded yet) fall back to the raw key.
            const labels = keys.map((k) => this._items.find((i) => i.key === k)?.label ?? k)
            return esc(labels.join(', '))
        }
        const sel = this._selectedItem()
        return sel ? esc(sel.label) : esc(this.placeholder)
    }

    private _updateTriggerLabel(): void {
        const el = this.querySelector('.tc-extended-select__trigger-label')
        if (el) el.innerHTML = this._triggerLabelHtml()
        const trigger = this.querySelector('.tc-extended-select__trigger')
        if (trigger) {
            const empty = this.multiple ? this.values.length === 0 : !this.value
            trigger.classList.toggle('tc-extended-select__trigger--placeholder', empty)
        }
    }

    private _syncValueInDOM(newValue: string | null): void {
        const hidden = this.querySelector<HTMLInputElement>('.tc-extended-select__hidden')
        if (hidden) hidden.value = newValue ?? ''
        this._updateTriggerLabel()
        const selected = this.multiple ? parseKeys(newValue) : newValue ? [newValue] : []
        const selectedSet = new Set(selected)
        const opts = this._menuRoot().querySelectorAll<HTMLElement>('[role="option"]')
        opts.forEach((opt) => {
            const isSelected = !!opt.dataset.key && selectedSet.has(opt.dataset.key)
            opt.setAttribute('aria-selected', String(isSelected))
            opt.classList.toggle('tc-extended-select__option--selected', isSelected)
        })
    }

    private _renderOptions(): string {
        const multiple = this.multiple
        const selectedSet = new Set(this._selectedKeys())
        if (!this._filteredItems.length) {
            return `<li class="tc-extended-select__no-results" role="presentation">${esc(this.noResultsText)}</li>`
        }
        return this._filteredItems
            .map((item, idx) => {
                const isSelected = selectedSet.has(item.key)
                const isActive = idx === this._activeIdx
                let cls = 'tc-extended-select__option'
                if (isSelected) cls += ' tc-extended-select__option--selected'
                if (isActive) cls += ' tc-extended-select__option--active'
                const descHtml = item.description
                    ? `<span class="tc-extended-select__option-desc">${esc(item.description)}</span>`
                    : ''
                // Multi mode carries a persistent leading checkbox (the tick is
                // revealed by CSS on --selected) so toggling never rewrites the
                // row; single mode appends the tick only to the chosen row.
                const boxHtml = multiple
                    ? `<span class="tc-extended-select__checkbox" aria-hidden="true">${checkIconHtml}</span>`
                    : ''
                const checkHtml =
                    !multiple && isSelected
                        ? `<span class="tc-extended-select__check" aria-hidden="true">${checkIconHtml}</span>`
                        : ''
                // check appears before description so it stays on the label's row (flex-wrap layout)
                return `<li class="${cls}" role="option" aria-selected="${isSelected}" id="${this._idPrefix}-${idx}" data-key="${esc(item.key)}" tabindex="-1">${boxHtml}<span class="tc-extended-select__option-label">${esc(item.label)}</span>${checkHtml}${descHtml}</li>`
            })
            .join('')
    }

    private _renderList(): void {
        const listEl = this._menuRoot().querySelector('.tc-extended-select__list')
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
        const multiple = this.multiple
        const isPlaceholder = multiple ? this.values.length === 0 : !currentValue
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
            invalidText: msg('selectionInvalid'),
            validText: 'Looks good!',
        })

        // The hidden input mirrors the value in the DOM (read by _syncValueInDOM)
        // but no longer submits — form submission flows through ElementInternals
        // (_syncForm) so the value is not duplicated under `name`. Its `name`
        // attribute is therefore intentionally omitted.
        // A full render mints a NEW menu inside the host, so the copy the sheet is
        // holding is now stale — and `_menuRoot()` would keep answering "the sheet"
        // and hand every later lookup the dead list. Dropped here, once, at the only
        // place that invalidates it.
        this._sheet?.querySelector('.tc-extended-select__menu')?.remove()

        // `--multiple` is on the MENU and not read off `tc-extended-select[multiple]`,
        // because in sheet mode the menu is not a descendant of the host any more — a
        // host-scoped selector would silently stop matching and the multi-select ticks
        // would never appear. One class, correct in both modes.
        const menuCls = `tc-extended-select__menu${multiple ? ' tc-extended-select__menu--multiple' : ''}`

        this.innerHTML = `${labelHtml}<input type="hidden" value="${esc(currentValue)}" class="tc-extended-select__hidden"><button type="button" class="${triggerCls}" role="combobox" aria-expanded="false" aria-controls="${this._listId}" aria-haspopup="listbox"${describe}${requiredAttr}${disabledAttr}><span class="tc-extended-select__trigger-label">${this._triggerLabelHtml()}</span><span class="tc-extended-select__trigger-spinner" aria-hidden="true"><span class="spinner-border spinner-border-sm"></span></span><span class="tc-extended-select__caret" aria-hidden="true">${chevronDownIcon}</span></button><div class="${menuCls}"><div class="tc-extended-select__search-wrap">${searchIconHtml}<input type="text" class="tc-extended-select__search-input" placeholder="${esc(this.searchPlaceholder)}" autocomplete="off" aria-label="${esc(msg('searchOptionsLabel'))}"></div><ul class="tc-extended-select__list" id="${this._listId}" role="listbox"${multiple ? ' aria-multiselectable="true"' : ''}>${this._renderOptions()}</ul><div class="tc-extended-select__loading-indicator" aria-live="polite" aria-label="${esc(msg('loading'))}"><span class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">${esc(msg('loading'))}</span></span></div></div>${messageHtml}`

        if (this.loading) this.setAttribute('aria-busy', 'true')

        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')
        if (trigger) trigger.addEventListener('click', this._onTriggerClick)

        const searchInput = this._menuRoot().querySelector<HTMLInputElement>(
            '.tc-extended-select__search-input',
        )
        if (searchInput) searchInput.addEventListener('input', this._onSearchInput)

        const list = this._menuRoot().querySelector<HTMLElement>('.tc-extended-select__list')
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
                invalidText: msg('selectionInvalid'),
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
        const useSheet = this._sheetMode()
        this._placeMenu(useSheet)
        this._isOpen = true

        const menu = this._menuRoot().querySelector('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLButtonElement>('.tc-extended-select__trigger')

        if (menu) menu.classList.add('tc-extended-select__menu--open')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')

        if (useSheet) {
            const sheet = this._ensureSheet()
            this._syncSheetChrome(sheet)
            const mount = this._sheetMount()
            if (sheet.parentElement !== mount) mount.appendChild(sheet)
            sheet.open = true
        } else {
            // Anchor the fixed-positioned menu to the trigger (escapes overflow
            // clipping from ancestor scroll containers), then keep it anchored
            // while the page or an ancestor scrolls/resizes underneath it.
            this._cbEl = fixedContainingBlock(this)
            this._positionMenu()
            this._repositionHandler = () => this._positionMenu()
            window.addEventListener('scroll', this._repositionHandler, true)
            window.addEventListener('resize', this._repositionHandler)
        }

        // Pre-highlight the selected item — the first one, under `multiple`.
        const selected = new Set(this._selectedKeys())
        if (selected.size) {
            const idx = this._filteredItems.findIndex((i) => selected.has(i.key))
            if (idx !== -1) {
                this._activeIdx = idx
                this._setActiveClass()
            }
        }

        if (!useSheet) {
            // Focus search input. NOT in sheet mode: focusing a text field raises the
            // software keyboard, and a sheet that opens with the keyboard up has just
            // covered half of its own option list. tc-bottom-sheet focuses the panel
            // itself for the same reason — see its _focusIn(). The keydown handler
            // below is on `document`, so arrow-key navigation works either way.
            const si = this._menuRoot().querySelector<HTMLInputElement>(
                '.tc-extended-select__search-input',
            )
            if (si) si.focus()

            // Outside-click dismissal, and ONLY in dropdown mode. In sheet mode the
            // menu is not a descendant of this element, so every tap on a sheet row
            // would read as "outside" and close it before the click landed. The
            // sheet's scrim is the dismiss surface there.
            this._outsideHandler = (e: MouseEvent) => {
                if (!this.contains(e.target as Node)) this._closeMenu()
            }
            document.addEventListener('mousedown', this._outsideHandler)
        }

        this._keyHandler = (e: KeyboardEvent) => this._onKeyDown(e)
        document.addEventListener('keydown', this._keyHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._activeIdx = -1

        // The sheet, if this open used one. Closed BEFORE the state teardown below so
        // its exit animation runs against a list that is still rendered; _closingSheet
        // stops its own `tc-sheet-close` from re-entering here.
        //
        // Left MOUNTED once closed — a closed tc-bottom-sheet is `display: none`, and
        // it is where the menu lives between opens. Removing it would mean moving the
        // list twice per open for no gain. `disconnectedCallback` is what disposes of
        // it, and it is the only place that needs to.
        const sheet = this._sheet
        if (sheet && sheet.open) {
            this._closingSheet = true
            void sheet.hide('action').finally(() => {
                this._closingSheet = false
            })
        }

        const menu = this._menuRoot().querySelector('.tc-extended-select__menu')
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
        const si = this._menuRoot().querySelector<HTMLInputElement>(
            '.tc-extended-select__search-input',
        )
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
        const menu = this._menuRoot().querySelector<HTMLElement>('.tc-extended-select__menu')
        const trigger = this.querySelector<HTMLElement>('.tc-extended-select__trigger')
        if (!menu || !trigger) return
        // Anchoring is a DROPDOWN concern. Inside a sheet the menu is a static flex
        // child and the sheet owns its box — writing top/left/width here would leave
        // inline styles on it that survive into the next dropdown-mode open.
        // `_renderList()` calls this on every filter keystroke, so the guard is here
        // rather than at each call site.
        if (menu.parentElement !== this) return

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
            const opt = this._menuRoot().querySelector(`#${this._idPrefix}-${idx}`)
            opt?.scrollIntoView({ block: 'nearest' })
        }
    }

    private _setActiveClass(): void {
        const prev = this._menuRoot().querySelector('.tc-extended-select__option--active')
        if (prev) prev.classList.remove('tc-extended-select__option--active')
        if (this._activeIdx >= 0) {
            const opt = this._menuRoot().querySelector(`#${this._idPrefix}-${this._activeIdx}`)
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
        if (this.multiple) {
            this._toggleItem(key)
            return
        }
        this.value = key
        // Push the new selection into the form before announcing it.
        this._syncForm()
        // Canonical change event — detail is exactly { value }.
        dispatchFieldChange(this, key)
        this.dispatchEvent(new Event('change', { bubbles: true }))
        this._notifyChange(key)
        this._closeMenu()
    }

    /**
     * Multi mode: flip one key in/out of the selection. The menu, the search
     * query and the scroll position all stay put — only the affected rows and
     * the trigger label are patched — so a run of picks needs one open.
     */
    private _toggleItem(key: string): void {
        const keys = this.values
        const idx = keys.indexOf(key)
        if (idx === -1) keys.push(key)
        else keys.splice(idx, 1)

        this.value = keys.join(',')
        // Patch rows + trigger directly; the attribute callback covers the same
        // ground but is skipped while disconnected/uninitialised.
        this._syncValueInDOM(this.getAttribute('value'))
        this._syncForm()
        dispatchFieldChange(this, keys)
        this.dispatchEvent(new Event('change', { bubbles: true }))
        this._notifyChange(keys)

        // Clicking a row focuses the <li> (tabindex="-1"); hand focus back so
        // typing keeps filtering and the key handler keeps its context.
        if (this._isOpen) {
            this._menuRoot()
                .querySelector<HTMLInputElement>('.tc-extended-select__search-input')
                ?.focus()
        }
    }

    /** onChange is a union of the single/multi signatures — narrow at the call. */
    private _notifyChange(value: string | string[]): void {
        if (typeof this.onChange === 'function') {
            ;(this.onChange as (v: string | string[]) => void)(value)
        }
    }

    // ── Search ────────────────────────────────────────────────────────────────

    private _onSearchInput = (): void => {
        const si = this._menuRoot().querySelector<HTMLInputElement>(
            '.tc-extended-select__search-input',
        )
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
                        (item.description ?? '').toLowerCase().includes(q) ||
                        item.keywords?.some((k) => k.toLowerCase().includes(q)) === true,
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

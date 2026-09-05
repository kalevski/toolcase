import { bindOnce, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
import { fixedOriginOffset } from './internal/containingBlock'
import { cssLength } from './internal/cssLength'
import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-icon-picker'

let _ipIdCounter = 0

export type IconPickerState = 'valid' | 'invalid'

const STATES: IconPickerState[] = ['valid', 'invalid']

export interface IconOption {
    value: string
    label?: string
}

export class IconPicker extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _icons: IconOption[] = []
    private _isOpen = false
    private _highlightIdx = -1
    private _searchValue = ''
    // Stable id for the reserved message slot (aria-describedby target on the trigger).
    private _helpId = `tc-ip-help-${++_ipIdCounter}`
    private _internals: ElementInternals
    private _defaultValue: string | null = null
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'value',
            'columns',
            'loading',
            'disabled',
            'required',
            'name',
            'max-height',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value')
            this.render()
            this._initialised = true
        }
        this._applyMaxHeight()
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._removeDocListeners()
    }

    /** Reset to the value present at first connect when the form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue
        this._syncForm()
    }

    /** Mirror a containing fieldset/form disabling into the host attribute. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /** Push value + validity into the form. Effective invalid = error / state
     *  invalid / required-but-empty. */
    private _syncForm(): void {
        const value = this.value
        setFieldFormValue(this._internals, this.name, value)
        const error = this.error
        const requiredEmpty = this.required && !value
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('fieldRequired') : msg('invalidIcon')),
            anchor: this._getTrigger() ?? undefined,
        })
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._applyMaxHeight()
        if (this._isOpen) this._forceClose()
        this.render()
        // Keep the form value/validity in step with value/required/error/state/name.
        this._syncForm()
    }

    /**
     * Cap how tall the icon grid grows before it scrolls. A bare number is read
     * as pixels; any CSS length (`50vh`, `20rem`, …) is honoured as-is. Removing
     * the attribute restores the stylesheet default (240px).
     */
    private _applyMaxHeight(): void {
        const h = cssLength(this.getAttribute('max-height'))
        if (h) this.style.setProperty('--bs-icon-picker-options-max-height', h)
        else this.style.removeProperty('--bs-icon-picker-options-max-height')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get icons(): IconOption[] {
        return this._icons
    }
    set icons(v: IconOption[]) {
        this._icons = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isOpen) this._forceClose()
            this.render()
        }
    }

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get columns(): number {
        return parseInt(this.getAttribute('columns') ?? '6', 10) || 6
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    // ── name (form field name) ──────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get maxHeight(): string {
        return this.getAttribute('max-height') ?? ''
    }
    set maxHeight(v: string) {
        if (v) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
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

    get state(): IconPickerState | null {
        const v = this.getAttribute('state') as IconPickerState
        return STATES.includes(v) ? v : null
    }
    set state(v: IconPickerState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-icon-picker-trigger')
    }

    private _getPopup(): HTMLElement | null {
        return this.querySelector('.tc-icon-picker-popup')
    }

    private _getSearchInput(): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>('.tc-icon-picker-search')
    }

    private _getOptions(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-icon-picker-option'))
    }

    private _getFilteredIcons(): IconOption[] {
        const q = this._searchValue.trim().toLowerCase()
        if (!q) return this._icons
        return this._icons.filter(
            (o) => o.value.toLowerCase().includes(q) || (o.label ?? '').toLowerCase().includes(q),
        )
    }

    private _forceClose(): void {
        this._isOpen = false
        this._searchValue = ''
        this._highlightIdx = -1
        this._removeDocListeners()
    }

    private _positionPopup(): void {
        const popup = this.querySelector<HTMLElement>('.tc-icon-picker-popup')
        const anchor = this.querySelector<HTMLElement>('.tc-icon-picker-trigger')
        if (!popup || !anchor) return

        const gap = 2
        const margin = 4
        const r = anchor.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        const popupH = popup.offsetHeight
        const popupW = popup.offsetWidth
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < popupH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - popupH - gap)
            : Math.min(r.bottom + gap, vh - popupH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - popupW - margin))
        top = Math.max(margin, top)

        // Re-base onto the containing block when a transformed/filtered ancestor
        // has hijacked `position: fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        top -= o.y
        left -= o.x

        popup.style.top = `${top}px`
        popup.style.left = `${left}px`
    }

    private _openPopup(): void {
        if (this._isOpen || this.disabled) return
        this._isOpen = true
        const trigger = this._getTrigger()
        const popup = this._getPopup()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (popup) popup.classList.add('show')

        // Anchor the fixed-positioned popup to the trigger (escapes overflow
        // clipping from ancestor scroll containers), then keep it anchored
        // while the page or an ancestor scrolls/resizes underneath it.
        this._positionPopup()
        this._repositionHandler = () => this._positionPopup()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)

        const searchInput = this._getSearchInput()
        if (searchInput) searchInput.focus()

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closePopup(false)
        }
        this._keydownHandler = (e: KeyboardEvent) => this._onKeydown(e)
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._keydownHandler)
    }

    private _closePopup(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._searchValue = ''
        this._highlightIdx = -1
        const trigger = this._getTrigger()
        const popup = this._getPopup()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (popup) popup.classList.remove('show')
        this._removeDocListeners()
        if (refocus) trigger?.focus()
    }

    private _removeDocListeners(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler)
            this._keydownHandler = null
        }
        if (this._repositionHandler) {
            window.removeEventListener('scroll', this._repositionHandler, true)
            window.removeEventListener('resize', this._repositionHandler)
            this._repositionHandler = null
        }
    }

    private _selectIcon(value: string): void {
        // setAttribute('value') triggers attributeChangedCallback → render +
        // _syncForm, so the new value reaches the form before we dispatch.
        this._closePopup(false)
        this.setAttribute('value', value)
        // Canonical tc-change with the unified `{ value }` detail.
        dispatchFieldChange(this, value)
        if (typeof this.onChange === 'function') this.onChange(value)
        this._getTrigger()?.focus()
    }

    private _setHighlight(idx: number): void {
        const options = this._getOptions()
        options.forEach((o, i) => {
            o.classList.toggle('tc-icon-picker-option--highlighted', i === idx)
        })
        if (options[idx]) options[idx].scrollIntoView({ block: 'nearest' })
    }

    private _onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault()
            this._closePopup()
            return
        }
        if (e.key === 'Tab') {
            this._closePopup(false)
            return
        }

        const filtered = this._getFilteredIcons()
        const cols = this.columns

        if (e.key === 'ArrowRight') {
            e.preventDefault()
            this._highlightIdx =
                this._highlightIdx < 0 ? 0 : Math.min(this._highlightIdx + 1, filtered.length - 1)
            this._setHighlight(this._highlightIdx)
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (this._highlightIdx > 0) {
                this._highlightIdx--
                this._setHighlight(this._highlightIdx)
            } else if (this._highlightIdx < 0) {
                this._highlightIdx = 0
                this._setHighlight(this._highlightIdx)
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            this._highlightIdx =
                this._highlightIdx < 0
                    ? 0
                    : Math.min(this._highlightIdx + cols, filtered.length - 1)
            this._setHighlight(this._highlightIdx)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (this._highlightIdx > 0) {
                this._highlightIdx = Math.max(this._highlightIdx - cols, 0)
                this._setHighlight(this._highlightIdx)
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (this._highlightIdx >= 0 && this._highlightIdx < filtered.length) {
                this._selectIcon(filtered[this._highlightIdx].value)
            }
        }
    }

    private _renderSkeletonPopup(): string {
        const cols = this.columns
        const count = cols * 3
        const cells = Array.from({ length: count })
            .map(() => `<div class="tc-icon-picker-skeleton-cell" aria-hidden="true"></div>`)
            .join('')
        return `<div class="tc-icon-picker-popup" role="status" aria-busy="true" aria-label="Loading icons"><div class="tc-icon-picker-grid tc-icon-picker-grid--loading" style="grid-template-columns:repeat(${cols},1fr);">${cells}</div><span class="visually-hidden">${esc(msg('loading'))}</span></div>`
    }

    private _renderGridContent(filtered: IconOption[]): string {
        if (filtered.length === 0) {
            return `<p class="tc-icon-picker-empty">No icons found</p>`
        }
        const cols = this.columns
        const currentValue = this.value ?? ''
        const options = filtered
            .map((o, i) => {
                const isSelected = o.value === currentValue
                const isHighlighted = i === this._highlightIdx
                const iconHtml = lucideByName(o.value)
                const title = o.label ?? o.value
                let cls = 'tc-icon-picker-option'
                if (isSelected) cls += ' tc-icon-picker-option--selected'
                if (isHighlighted) cls += ' tc-icon-picker-option--highlighted'
                return `<button class="${cls}" type="button" role="option" aria-selected="${isSelected}" tabindex="-1" title="${esc(title)}" data-value="${esc(o.value)}">${iconHtml}</button>`
            })
            .join('')
        return `<div class="tc-icon-picker-grid" style="grid-template-columns:repeat(${cols},1fr);">${options}</div>`
    }

    private render(): void {
        const labelText = this.getAttribute('label')
        const currentValue = this.value ?? ''
        const loading = this.loading
        const disabled = this.disabled
        const required = this.required
        const error = this.error
        // A non-empty `error` forces the invalid state (matches tc-select).
        const state: IconPickerState | null = error ? 'invalid' : this.state
        const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
        // The trigger is the focusable control, so the required hint rides there.
        const requiredAttr = required ? ' aria-required="true"' : ''

        const labelHtml = labelText
            ? `<label class="tc-icon-picker-label">${esc(labelText)}${requiredMark(required)}</label>`
            : ''

        const selectedIconHtml = currentValue ? lucideByName(currentValue) : ''
        const expanded = this._isOpen ? 'true' : 'false'
        const triggerInner = `<span class="tc-icon-picker-trigger-icon" aria-hidden="true">${selectedIconHtml}</span><span class="tc-icon-picker-trigger-chevron" aria-hidden="true">${chevronDownIcon}</span>`

        let popupHtml: string
        if (loading) {
            popupHtml = this._renderSkeletonPopup()
        } else {
            const filtered = this._getFilteredIcons()
            const searchHtml = `<input class="tc-icon-picker-search" type="search" placeholder="Search icons…" value="${esc(this._searchValue)}" autocomplete="off" />`
            const gridContent = this._renderGridContent(filtered)
            popupHtml = `<div class="tc-icon-picker-popup" role="listbox" aria-label="Icons">${searchHtml}<div class="tc-icon-picker-options">${gridContent}</div></div>`
        }

        // Bespoke trigger: no native .form-control, so paint the invalid border
        // via a local .is-invalid rule in _icon-picker.scss (not message styling).
        const triggerStateClass = state === 'invalid' ? ' is-invalid' : ''
        // Point aria-describedby at the slot only when it carries a message.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''

        // One reserved message slot as the LAST child of the host, after the
        // trigger and overlay popup (invalid > valid > hint).
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('invalidIcon'),
            validText: 'Looks good!',
        })

        patchHtml(
            this,
            `${labelHtml}<button class="tc-icon-picker-trigger${triggerStateClass}" type="button" aria-haspopup="listbox" aria-expanded="${expanded}"${requiredAttr}${describe}${disabledAttr}>${triggerInner}</button>${popupHtml}${messageHtml}`,
        )

        if (this._isOpen) {
            const popup = this._getPopup()
            if (popup) popup.classList.add('show')
        }

        const trigger = this._getTrigger()
        if (trigger) {
            bindOnce(trigger, 'click', () => {
                if (this._isOpen) this._closePopup(false)
                else this._openPopup()
            })
        }

        if (!loading) {
            const optionsEl = this.querySelector<HTMLElement>('.tc-icon-picker-options')
            if (optionsEl) {
                bindOnce(optionsEl, 'click', (e: Event) => {
                    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
                        '.tc-icon-picker-option',
                    )
                    if (btn) {
                        const val = btn.dataset.value ?? ''
                        if (val) this._selectIcon(val)
                    }
                })
            }

            const searchInput = this._getSearchInput()
            if (searchInput) {
                bindOnce(searchInput, 'input', () => {
                    this._searchValue = searchInput.value
                    this._highlightIdx = -1
                    const el = this.querySelector<HTMLElement>('.tc-icon-picker-options')
                    if (el) el.innerHTML = this._renderGridContent(this._getFilteredIcons())
                    // Filtering changes the popup height; re-anchor so a flipped-up
                    // popup stays attached to the trigger instead of drifting.
                    if (this._isOpen) this._positionPopup()
                })
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconPicker
    }
}

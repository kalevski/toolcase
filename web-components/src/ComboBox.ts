import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { chevronDownIcon } from './icons'
import { fixedContainingBlock } from './internal/containingBlock'
import { cssLength } from './internal/cssLength'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'

const TAG_NAME = 'tc-combo-box'

// Unique-id source so the reserved message slot has a stable id for the
// trigger's aria-describedby wiring across instances.
let _idCounter = 0

export type ComboBoxState = 'valid' | 'invalid'

const STATES: ComboBoxState[] = ['valid', 'invalid']

export interface ComboOption {
    value: string
    label: string
    keywords?: string[]
}

export class ComboBox extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _helpId: string
    private _options: ComboOption[] = []
    private _isOpen = false
    private _query = ''
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _docKeyHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null
    private _internals: ElementInternals
    private _defaultValue = ''
    // Ancestor (if any) that establishes the popover's containing block while
    // open — see _containingBlock(). The fixed coords are resolved against this
    // box, not the viewport, when non-null.
    private _cbEl: HTMLElement | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'name',
            'placeholder',
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
        // Stable id minted once per instance — the reserved message slot keeps
        // it across re-renders so the trigger's aria-describedby never dangles.
        this._helpId = `tc-combo-box-help-${++_idCounter}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'combobox')
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
            this.render()
            this._initialised = true
        }
        this._applyMaxHeight()
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._removeOpenHandlers()
        this._isOpen = false
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue
        this._patchTriggerLabel()
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'max-height') {
            this._applyMaxHeight()
            return
        }
        // `value`/`name`/`required` affect form participation but not the open
        // popover, so push them into the form without a full re-render that
        // would drop the popover's anchoring/focus. `value` also refreshes the
        // trigger label and selected-option marker in place.
        if (name === 'value') {
            this._patchTriggerLabel()
            this._syncForm()
            return
        }
        if (name === 'name' || name === 'required') {
            this._syncForm()
            return
        }
        // Validation-only attributes patch the reserved slot (and the trigger's
        // invalid border) in place. A full render() would tear down and rebuild
        // an open popover, dropping its anchoring and the search field's focus —
        // so we touch only the affected nodes and leave the popover alone.
        if (name === 'help' || name === 'error' || name === 'state') {
            this._patchMessage()
            this._syncForm()
            return
        }
        this._applyMaxHeight()
        this.render()
    }

    /**
     * Push value + validity into the form. Effective invalid = error / state
     * invalid / required-but-empty. Mirrors the shared form-field contract.
     */
    private _syncForm(): void {
        const value = this.value
        setFieldFormValue(this._internals, this.name, value === '' ? null : value)
        const error = this.error
        const requiredEmpty = this.required && value === ''
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('selectionRequired') : msg('selectionInvalid')),
            anchor: this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger') ?? undefined,
        })
    }

    /**
     * Refresh the trigger label + selected-option marker after a `value` change,
     * without re-rendering an open popover (which would drop its anchoring).
     */
    private _patchTriggerLabel(): void {
        const selected = this._options.find((o) => o.value === this.value)
        const labelEl = this.querySelector<HTMLElement>('.tc-combo-box__trigger-label')
        const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
        if (labelEl) labelEl.textContent = selected ? selected.label : this.placeholder
        if (trigger) trigger.classList.toggle('tc-combo-box__trigger--placeholder', !selected)
        // Reflect the selection onto any currently rendered options.
        this.querySelectorAll<HTMLElement>('.tc-combo-box__option').forEach((el) => {
            const isSelected = el.dataset.value === this.value
            el.classList.toggle('tc-combo-box__option--selected', isSelected)
            el.setAttribute('aria-selected', String(isSelected))
        })
    }

    /**
     * Patch the reserved message slot and the trigger's invalid border in place,
     * without re-rendering the trigger or the (possibly open) popover.
     */
    private _patchMessage(): void {
        const error = this.error
        const state: ComboBoxState | null = error ? 'invalid' : this.state
        const slot = this.querySelector<HTMLElement>('.tc-field-message')
        if (slot) {
            slot.outerHTML = fieldMessageHtml({
                id: this._helpId,
                state,
                error,
                hint: this.help,
                invalidText: msg('selectionInvalid'),
                validText: 'Looks good!',
            })
        }
        const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
        if (trigger) {
            trigger.classList.toggle('tc-combo-box__trigger--invalid', state === 'invalid')
            if (this.help || state) trigger.setAttribute('aria-describedby', this._helpId)
            else trigger.removeAttribute('aria-describedby')
        }
    }

    /**
     * Cap how tall the options list grows before it scrolls. A bare number is
     * read as pixels; any CSS length (`50vh`, `20rem`, …) is honoured as-is.
     * Removing the attribute restores the stylesheet default (240px).
     */
    private _applyMaxHeight(): void {
        const h = cssLength(this.getAttribute('max-height'))
        if (h) this.style.setProperty('--bs-combo-box-list-max-height', h)
        else this.style.removeProperty('--bs-combo-box-list-max-height')
    }

    // ── Attribute getters/setters ─────────────────────────────────────────

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    // ── name (form field name) ───────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? msg('selectPlaceholder')
    }
    set placeholder(v: string) {
        if (v) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

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

    get state(): ComboBoxState | null {
        const v = this.getAttribute('state') as ComboBoxState
        return STATES.includes(v) ? v : null
    }
    set state(v: ComboBoxState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    // ── JS property: options ──────────────────────────────────────────────

    get options(): ComboOption[] {
        return this._options
    }
    set options(v: ComboOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    // ── Open/close ─────────────────────────────────────────────────────────

    private _toggleOpen(force?: boolean): void {
        if (this.disabled) {
            this._isOpen = false
        } else {
            this._isOpen = force != null ? force : !this._isOpen
        }
        if (!this._isOpen) {
            this._query = ''
            this._removeOpenHandlers()
        }
        this.render()
        if (this._isOpen) {
            this._attachOpenHandlers()
            const input = this.querySelector<HTMLInputElement>('.tc-combo-box__search-input')
            if (input) requestAnimationFrame(() => input.focus())
        }
    }

    private _attachOpenHandlers(): void {
        this._removeOpenHandlers()
        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._toggleOpen(false)
        }
        this._docKeyHandler = (e: KeyboardEvent) => {
            if (!this._isOpen) return
            if (e.key === 'Escape') {
                e.preventDefault()
                this._toggleOpen(false)
                const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
                trigger?.focus()
            }
        }
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._docKeyHandler)

        // Anchor the fixed-positioned popover to the trigger (escapes overflow
        // clipping from ancestor scroll containers), then keep it anchored while
        // the page or an ancestor scrolls/resizes underneath it.
        this._cbEl = fixedContainingBlock(this)
        this._positionPanel()
        this._repositionHandler = () => this._positionPanel()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)
    }

    private _removeOpenHandlers(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._docKeyHandler) {
            document.removeEventListener('keydown', this._docKeyHandler)
            this._docKeyHandler = null
        }
        if (this._repositionHandler) {
            window.removeEventListener('scroll', this._repositionHandler, true)
            window.removeEventListener('resize', this._repositionHandler)
            this._repositionHandler = null
        }
        this._cbEl = null
    }

    /**
     * Position the fixed popover against the trigger in viewport coordinates.
     * Width matches the trigger; the popover opens below by default and flips
     * above when there isn't room beneath it. Left/top are clamped so the panel
     * never spills off-screen.
     *
     * When an ancestor establishes a containing block (see _containingBlock),
     * `position: fixed` resolves against that ancestor's box rather than the
     * viewport, so the viewport coordinates are converted into its local frame
     * before being written — otherwise the popover drifts by the ancestor offset.
     */
    private _positionPanel(): void {
        const panel = this.querySelector<HTMLElement>('.tc-combo-box__popover')
        const anchor = this.querySelector<HTMLElement>('.tc-combo-box__trigger')
        if (!panel || !anchor) return

        const gap = 2
        const margin = 4 // keep a small breathing gap from viewport edges
        const r = anchor.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        panel.style.width = `${r.width}px`

        const panelH = panel.offsetHeight
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < panelH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - panelH - gap)
            : Math.min(r.bottom + gap, vh - panelH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - r.width - margin))
        top = Math.max(margin, top)

        // Re-base the viewport coords onto the containing block's frame when a
        // transformed/filtered/contained ancestor has hijacked `fixed`.
        if (this._cbEl) {
            const cb = this._cbEl.getBoundingClientRect()
            top -= cb.top
            left -= cb.left
        }

        panel.style.top = `${top}px`
        panel.style.left = `${left}px`
    }

    // ── Filtering ──────────────────────────────────────────────────────────

    private _filteredOptions(): ComboOption[] {
        const q = this._query.trim().toLowerCase()
        if (!q) return this._options
        return this._options.filter((opt) => {
            if (opt.label.toLowerCase().includes(q)) return true
            if (opt.value.toLowerCase().includes(q)) return true
            if (opt.keywords?.some((k) => k.toLowerCase().includes(q))) return true
            return false
        })
    }

    private _buildOptionsHtml(): string {
        const filtered = this._filteredOptions()
        if (!filtered.length) {
            return `<div class="tc-combo-box__empty">No matches</div>`
        }
        return filtered
            .map((opt) => {
                const isSelected = opt.value === this.value
                const selectedCls = isSelected ? ' tc-combo-box__option--selected' : ''
                return (
                    `<div class="tc-combo-box__option${selectedCls}" role="option"` +
                    ` tabindex="0" aria-selected="${isSelected}" data-value="${esc(opt.value)}">` +
                    `${esc(opt.label)}</div>`
                )
            })
            .join('')
    }

    // ── Selection ──────────────────────────────────────────────────────────

    private _select(value: string): void {
        if (!value || value === this.value) {
            this._toggleOpen(false)
            return
        }
        this.value = value
        this._toggleOpen(false)
        // Push the new selection into the form before announcing it.
        this._syncForm()
        // Canonical change event — detail is exactly { value }.
        dispatchFieldChange(this, value)
        this.dispatchEvent(new Event('change', { bubbles: true }))
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    // ── Render ─────────────────────────────────────────────────────────────

    private render(): void {
        const selected = this._options.find((o) => o.value === this.value)
        const triggerLabel = selected ? selected.label : this.placeholder
        const placeholderCls = selected ? '' : ' tc-combo-box__trigger--placeholder'

        // An `error` message forces the invalid state; otherwise honour `state`.
        const error = this.error
        const state: ComboBoxState | null = error ? 'invalid' : this.state
        const invalidCls = state === 'invalid' ? ' tc-combo-box__trigger--invalid' : ''
        // Describe the trigger by the reserved slot only when it carries content.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''
        const required = this.required
        // aria-required surfaces the requirement to assistive tech on the trigger
        // (the focusable control standing in for a native <select>).
        const requiredAttr = required ? ' aria-required="true"' : ''

        const label = this.label
        const labelHtml = label
            ? `<label class="form-label tc-combo-box__label">${esc(label)}${requiredMark(required)}</label>`
            : ''

        let popoverHtml = ''
        if (this._isOpen && !this.disabled) {
            popoverHtml =
                `<div class="tc-combo-box__popover">` +
                `<div class="tc-combo-box__search">` +
                `<input type="text" class="tc-combo-box__search-input" placeholder="${esc(msg('searchPlaceholder'))}"` +
                ` autocomplete="off" aria-label="${esc(msg('searchOptionsLabel'))}" value="${esc(this._query)}" />` +
                `</div>` +
                `<div class="tc-combo-box__list" role="listbox">${this._buildOptionsHtml()}</div>` +
                `</div>`
        }

        // Reserved message slot — plain block flow as the LAST host child, after
        // the trigger and the (fixed-positioned) popover. It is intentionally
        // outside the popover so it never inherits the popover's overflow/fixed
        // positioning and is always visible beneath the control.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('selectionInvalid'),
            validText: 'Looks good!',
        })

        patchHtml(
            this,
            labelHtml +
                `<button type="button" class="tc-combo-box__trigger${placeholderCls}${invalidCls}"` +
                ` aria-haspopup="listbox" aria-expanded="${this._isOpen && !this.disabled}"` +
                `${describe}${requiredAttr}` +
                ` ${this.disabled ? 'disabled' : ''}>` +
                `<span class="tc-combo-box__trigger-label">${esc(triggerLabel)}</span>` +
                `<span class="tc-combo-box__caret">${chevronDownIcon}</span>` +
                `</button>` +
                popoverHtml +
                messageHtml,
        )

        const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
        bindOnce(trigger, 'click', () => this._toggleOpen())

        const input = this.querySelector<HTMLInputElement>('.tc-combo-box__search-input')
        if (input) {
            bindOnce(input, 'input', () => {
                this._query = input.value
                this._renderListOnly()
            })
            bindOnce(input, 'keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    const first = this.querySelector<HTMLElement>('.tc-combo-box__option')
                    if (first?.dataset.value != null) this._select(first.dataset.value)
                }
            })
        }

        this._wireOptions()
    }

    private _renderListOnly(): void {
        const list = this.querySelector<HTMLElement>('.tc-combo-box__list')
        if (!list) return
        list.innerHTML = this._buildOptionsHtml()
        this._wireOptions()
        // Filtering changes the popover height; re-anchor so a flipped-up panel
        // stays attached to the trigger instead of drifting.
        if (this._isOpen) this._positionPanel()
    }

    private _wireOptions(): void {
        this.querySelectorAll<HTMLElement>('.tc-combo-box__option').forEach((el) => {
            const handle = () => this._select(el.dataset.value ?? '')
            bindOnce(el, 'click', handle)
            bindOnce(el, 'keydown', (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                handle()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ComboBox
    }
}

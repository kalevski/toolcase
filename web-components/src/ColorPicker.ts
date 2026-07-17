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
import { Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-color-picker'

let _cpIdCounter = 0

export type ColorPickerState = 'valid' | 'invalid'

const STATES: ColorPickerState[] = ['valid', 'invalid']

export interface ColorOption {
    value: string
    label?: string
}

function normalizeColor(c: string | ColorOption): ColorOption {
    if (typeof c === 'string') return { value: c }
    return c
}

function isValidHex(hex: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

const checkIconHtml = icon(Check)

export class ColorPicker extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _colors: ColorOption[] = []
    private _isOpen = false
    private _hexInputId: string
    // Stable id for the reserved message slot (aria-describedby target on the trigger).
    private _helpId: string
    private _internals: ElementInternals
    private _defaultValue: string | null = null
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null

    onChange: ((color: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'value',
            'columns',
            'loading',
            'disabled',
            'required',
            'name',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        const uid = ++_cpIdCounter
        this._hexInputId = `tc-cp-hex-${uid}`
        this._helpId = `tc-cp-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value')
            this.render()
            this._initialised = true
        }
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
            message: error || (requiredEmpty ? msg('fieldRequired') : msg('invalidColor')),
            anchor: this._getTrigger() ?? undefined,
        })
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._isOpen) {
            this._forceClose()
        }
        this.render()
        // Keep the form value/validity in step with value/required/error/state/name.
        this._syncForm()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get colors(): ColorOption[] {
        return this._colors
    }
    set colors(v: Array<ColorOption | string>) {
        this._colors = Array.isArray(v) ? v.map(normalizeColor) : []
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
        return parseInt(this.getAttribute('columns') ?? '8', 10) || 8
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

    get state(): ColorPickerState | null {
        const v = this.getAttribute('state') as ColorPickerState
        return STATES.includes(v) ? v : null
    }
    set state(v: ColorPickerState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-color-picker-trigger')
    }

    private _getPanel(): HTMLElement | null {
        return this.querySelector('.tc-color-picker-panel')
    }

    private _getSwatches(): HTMLButtonElement[] {
        return Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-color-picker-swatch:not([disabled])'),
        )
    }

    private _forceClose(): void {
        this._isOpen = false
        this._removeDocListeners()
    }

    /**
     * Position the fixed panel against the trigger in viewport coordinates.
     * The panel keeps its own CSS width (it's not full-input-width), so width
     * is left untouched; offsetWidth is used only to clamp the panel within the
     * viewport. The panel opens below by default and flips above when there
     * isn't room beneath it.
     */
    private _positionPanel(): void {
        const panel = this._getPanel()
        const anchor = this._getTrigger()
        if (!panel || !anchor) return

        const gap = 2
        const margin = 4
        const r = anchor.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        const panelH = panel.offsetHeight
        const panelW = panel.offsetWidth
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < panelH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - panelH - gap)
            : Math.min(r.bottom + gap, vh - panelH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - panelW - margin))
        top = Math.max(margin, top)

        // Re-base onto the containing block when a transformed/filtered ancestor
        // has hijacked `position: fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        top -= o.y
        left -= o.x

        panel.style.top = `${top}px`
        panel.style.left = `${left}px`
    }

    private _openPanel(): void {
        if (this._isOpen || this.disabled) return
        this._isOpen = true
        const trigger = this._getTrigger()
        const panel = this._getPanel()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (panel) panel.classList.add('show')

        this._positionPanel()
        this._repositionHandler = () => this._positionPanel()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)

        const swatches = this._getSwatches()
        const currentValue = this.value ?? ''
        const selected = swatches.find((s) => s.dataset.value === currentValue)
        if (selected) selected.focus()
        else if (swatches.length > 0) swatches[0].focus()

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closePanel(false)
        }
        this._keydownHandler = (e: KeyboardEvent) => this._onPanelKeydown(e)
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._keydownHandler)
    }

    private _closePanel(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        const trigger = this._getTrigger()
        const panel = this._getPanel()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (panel) panel.classList.remove('show')
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

    private _selectColor(color: string): void {
        // Close the panel first (sets _isOpen = false, cleans up listeners).
        // Then set value attribute — attributeChangedCallback fires and calls
        // render() with _isOpen already false, so the fresh DOM is consistent
        // (and _syncForm runs from there to push the new value into the form).
        this._closePanel(false)
        this.setAttribute('value', color)
        // Canonical tc-change with the unified `{ value }` detail (was `{ color }`).
        dispatchFieldChange(this, color)
        if (typeof this.onChange === 'function') this.onChange(color)
        // Restore focus to trigger after the re-render caused by setAttribute.
        this._getTrigger()?.focus()
    }

    private _onPanelKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault()
            this._closePanel()
            return
        }

        const swatches = this._getSwatches()
        if (swatches.length === 0) return

        const focused = document.activeElement as HTMLElement
        const currentIdx = swatches.indexOf(focused as HTMLButtonElement)
        const cols = this.columns

        if (e.key === 'ArrowRight') {
            e.preventDefault()
            swatches[(currentIdx + 1) % swatches.length].focus()
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            swatches[(currentIdx - 1 + swatches.length) % swatches.length].focus()
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = currentIdx + cols
            swatches[Math.min(next, swatches.length - 1)].focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = currentIdx - cols
            swatches[Math.max(prev, 0)].focus()
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (currentIdx >= 0) {
                const color = swatches[currentIdx].dataset.value ?? ''
                if (color) this._selectColor(color)
            }
        } else if (e.key === 'Tab') {
            this._closePanel(false)
        }
    }

    private _renderSkeleton(): string {
        const cols = this.columns
        const count = cols * 3
        const items = Array.from({ length: count })
            .map(() => `<div class="tc-color-picker-swatch-skeleton"></div>`)
            .join('')
        return `<div class="tc-color-picker-grid tc-color-picker-grid--loading" style="grid-template-columns:repeat(${cols},1fr);">${items}</div>`
    }

    private _renderGrid(): string {
        const cols = this.columns
        const currentValue = this.value ?? ''
        const disabled = this.disabled

        const swatches = this._colors
            .map((c) => {
                const isSelected = c.value === currentValue
                const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
                const ariaSelected = isSelected ? ' aria-selected="true"' : ' aria-selected="false"'
                const label = c.label ?? c.value
                return `<button class="tc-color-picker-swatch${isSelected ? ' tc-color-picker-swatch--selected' : ''}" type="button" role="option"${ariaSelected}${disabledAttr} data-value="${esc(c.value)}" aria-label="${esc(label)}" style="background:${esc(c.value)};" tabindex="-1">${isSelected ? `<span class="tc-color-picker-check" aria-hidden="true">${checkIconHtml}</span>` : ''}</button>`
            })
            .join('')

        return `<div class="tc-color-picker-grid" role="listbox" aria-label="Color swatches" style="grid-template-columns:repeat(${cols},1fr);">${swatches}</div>`
    }

    private render(): void {
        const labelText = this.getAttribute('label')
        const currentValue = this.value ?? ''
        const disabled = this.disabled
        const required = this.required
        const loading = this.loading
        const error = this.error
        // A non-empty `error` forces the invalid state (matches tc-select).
        const state: ColorPickerState | null = error ? 'invalid' : this.state
        const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
        // The trigger is the focusable control, so the required hint rides there.
        const requiredAttr = required ? ' aria-required="true"' : ''

        const chipStyle = currentValue ? ` style="background:${esc(currentValue)};"` : ''
        const triggerText = currentValue ? esc(currentValue) : 'Select color'

        const labelHtml = labelText
            ? `<label class="tc-color-picker-label form-label" for="tc-cp-trigger-${this._hexInputId}">${esc(labelText)}${requiredMark(required)}</label>`
            : ''

        const hexValue = currentValue ? esc(currentValue) : ''
        const gridHtml = loading ? this._renderSkeleton() : this._renderGrid()

        // Bespoke trigger: no native .form-control, so paint the invalid border
        // via a local .is-invalid rule in _color-picker.scss (not message styling).
        const triggerStateClass = state === 'invalid' ? ' is-invalid' : ''
        // Point aria-describedby at the slot only when it carries a message.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''

        // One reserved message slot as the LAST child of the host, after the
        // trigger and overlay panel (invalid > valid > hint).
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('invalidColor'),
            validText: 'Looks good!',
        })

        this.innerHTML = `${labelHtml}<button class="tc-color-picker-trigger${triggerStateClass}" id="tc-cp-trigger-${this._hexInputId}" type="button" aria-haspopup="listbox" aria-expanded="false"${requiredAttr}${describe}${disabledAttr}><span class="tc-color-picker-chip" aria-hidden="true"${chipStyle}></span><span class="tc-color-picker-hex-text">${triggerText}</span></button><div class="tc-color-picker-panel" role="dialog" aria-label="Color picker" aria-modal="false">${gridHtml}<div class="tc-color-picker-footer"><label class="visually-hidden" for="${this._hexInputId}">Hex color value</label><input class="tc-color-picker-hex form-control" id="${this._hexInputId}" type="text" placeholder="#000000" value="${hexValue}" spellcheck="false" autocomplete="off"${disabled ? ' disabled' : ''} /></div></div>${messageHtml}`

        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', () => {
                if (this._isOpen) this._closePanel(false)
                else this._openPanel()
            })
        }

        const grid = this.querySelector('.tc-color-picker-grid')
        if (grid && !loading) {
            grid.addEventListener('click', (e: Event) => {
                const swatch = (e.target as HTMLElement).closest<HTMLButtonElement>(
                    '.tc-color-picker-swatch',
                )
                if (swatch && !swatch.disabled) {
                    const color = swatch.dataset.value ?? ''
                    if (color) this._selectColor(color)
                }
            })
        }

        const hexInput = this.querySelector<HTMLInputElement>('.tc-color-picker-hex')
        if (hexInput) {
            hexInput.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = hexInput.value.trim()
                    if (isValidHex(val)) {
                        this._selectColor(val)
                    }
                }
            })
            hexInput.addEventListener('blur', () => {
                if (!hexInput.isConnected) return
                const val = hexInput.value.trim()
                if (isValidHex(val) && val !== (this.value ?? '')) {
                    this._selectColor(val)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ColorPicker
    }
}

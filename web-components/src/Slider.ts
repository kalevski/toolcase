import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
import { msg } from './messages'
const TAG_NAME = 'tc-slider'

let _idCounter = 0

export type SliderState = 'valid' | 'invalid'
const STATES: SliderState[] = ['valid', 'invalid']

function snapToStep(v: number, min: number, max: number, step: number): number {
    if (step <= 0 || max <= min) return Math.min(Math.max(v, min), max)
    const steps = Math.round((v - min) / step)
    const raw = min + steps * step
    const precision = Math.max(
        (step.toString().split('.')[1] ?? '').length,
        (min.toString().split('.')[1] ?? '').length,
    )
    const factor = Math.pow(10, precision)
    return Math.min(Math.max(Math.round(raw * factor) / factor, min), max)
}

export class Slider extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _idPrefix = `tc-slider-${++_idCounter}`
    // Shared id for the reserved field-message slot, referenced by aria-describedby.
    private _helpId = `${this._idPrefix}-help`
    private _dragging = false
    private _dragMoveHandler: ((e: PointerEvent) => void) | null = null
    private _dragUpHandler: (() => void) | null = null
    private _formatValue: ((value: number) => string) | null = null
    private _internals: ElementInternals
    // Initial `value` attribute, captured on first connect for formResetCallback.
    private _defaultValue: string | null = null

    onChange: ((value: number) => void) | null = null

    constructor() {
        super()
        this._internals = this.attachInternals()
    }

    static get observedAttributes(): string[] {
        return [
            'value',
            'min',
            'max',
            'step',
            'ticks',
            'show-tooltip',
            'label',
            'name',
            'required',
            'error',
            'state',
            'help',
            'disabled',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture the authored value so a form reset can restore it.
            this._defaultValue = this.getAttribute('value')
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._cleanupDrag()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        // Restore the authored value (or clear it) without re-rendering structure.
        if (this._defaultValue != null) this.setAttribute('value', this._defaultValue)
        else this.removeAttribute('value')
        this._patchValue()
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // A bare value change only repositions the fill/thumb — no structural re-render.
        if (name === 'value') {
            this._patchValue()
            this._syncForm()
            return
        }
        this.render()
        // required/error/state changes shift effective validity, so re-sync.
        this._syncForm()
    }

    // ── Attribute-backed props ──────────────────────────────────────────────

    get min(): number {
        return parseFloat(this.getAttribute('min') ?? '0') || 0
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        const raw = parseFloat(this.getAttribute('max') ?? '100')
        return isNaN(raw) ? 100 : raw
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get step(): number {
        const raw = parseFloat(this.getAttribute('step') ?? '1')
        return isNaN(raw) || raw <= 0 ? 1 : raw
    }
    set step(v: number) {
        this.setAttribute('step', String(v))
    }

    get ticks(): boolean {
        return this.hasAttribute('ticks')
    }
    set ticks(v: boolean) {
        if (v) this.setAttribute('ticks', '')
        else this.removeAttribute('ticks')
    }

    get showTooltip(): boolean {
        return this.hasAttribute('show-tooltip')
    }
    set showTooltip(v: boolean) {
        if (v) this.setAttribute('show-tooltip', '')
        else this.removeAttribute('show-tooltip')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    // Hint text shown in the reserved message slot (lowest precedence).
    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    // 'valid' | 'invalid'; an `error` message forces 'invalid'.
    get state(): SliderState | null {
        const v = this.getAttribute('state') as SliderState
        return STATES.includes(v) ? v : null
    }
    set state(v: SliderState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── name (form field name) ───────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // ── required ─────────────────────────────────────────────────────────────
    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    // `value` is controlled via the attribute — the getter always returns a
    // clamped + snapped number; the setter reflects to the attribute.
    get value(): number {
        return this._currentValue()
    }
    set value(v: number) {
        const min = this.min
        const max = this.max
        this.setAttribute(
            'value',
            String(snapToStep(Math.min(Math.max(v, min), max), min, max, this.step)),
        )
    }

    // `formatValue` is a function → exposed as a JS property (not an attribute).
    get formatValue(): ((value: number) => string) | null {
        return this._formatValue
    }
    set formatValue(fn: ((value: number) => string) | null) {
        this._formatValue = typeof fn === 'function' ? fn : null
        if (this._initialised) this._patchValue()
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private _currentValue(): number {
        const min = this.min
        const max = this.max
        const raw = parseFloat(this.getAttribute('value') ?? '')
        const base = isNaN(raw) ? min : raw
        return snapToStep(Math.min(Math.max(base, min), max), min, max, this.step)
    }

    private _format(v: number): string {
        if (typeof this._formatValue === 'function') {
            try {
                return String(this._formatValue(v))
            } catch {
                return String(v)
            }
        }
        return String(v)
    }

    private _pct(v: number): number {
        const min = this.min
        const max = this.max
        if (max === min) return 0
        return ((v - min) / (max - min)) * 100
    }

    private _patchValue(): void {
        const value = this._currentValue()
        const pct = this._pct(value)
        const valueText = this._format(value)

        const fill = this.querySelector<HTMLElement>('.tc-slider-fill')
        if (fill) fill.style.width = `${pct}%`

        const thumb = this.querySelector<HTMLElement>('.tc-slider-thumb')
        if (thumb) {
            thumb.style.left = `${pct}%`
            thumb.setAttribute('aria-valuenow', String(value))
            thumb.setAttribute('aria-valuetext', valueText)
            // Near the extremes the value chip flips inward instead of
            // overflowing the container edge (see _slider.scss edge rules).
            thumb.classList.toggle('tc-slider-thumb--edge-start', pct < 8)
            thumb.classList.toggle('tc-slider-thumb--edge-end', pct > 92)
            const tooltip = thumb.querySelector<HTMLElement>('.tc-slider-tooltip')
            if (tooltip) tooltip.textContent = valueText
        }
    }

    /** Push value + validity into the form. A slider always resolves to a number,
     *  so "empty" only means the author never set a `value` attribute; required
     *  flags that case as invalid. Must NOT re-render — value patches are in-place. */
    private _syncForm(): void {
        const hasValue = this.getAttribute('value') !== null
        const value = this._currentValue()
        // Serialize as a string (or null when no value was authored).
        setFieldFormValue(this._internals, this.name, hasValue ? String(value) : null)
        const error = this.error
        const requiredEmpty = this.required && !hasValue
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('fieldRequired') : msg('invalidChoice')),
            anchor: this.querySelector<HTMLElement>('.tc-slider-thumb') ?? undefined,
        })
    }

    private _fireChange(value: number): void {
        // Canonical tc-change carries `detail: { value }` (shared contract).
        dispatchFieldChange(this, value)
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    /** Commit a raw (un-snapped) value: clamp, snap, reflect, and announce. */
    private _setValue(raw: number): void {
        const min = this.min
        const max = this.max
        const snapped = snapToStep(Math.min(Math.max(raw, min), max), min, max, this.step)
        // setAttribute triggers _patchValue via attributeChangedCallback.
        this.setAttribute('value', String(snapped))
        this._fireChange(snapped)
    }

    private _valueFromClientX(clientX: number): number {
        const rect = this.querySelector('.tc-slider-track')?.getBoundingClientRect()
        if (!rect || rect.width === 0) return this.min
        const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        return this.min + pct * (this.max - this.min)
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (this.disabled) return
        const target = e.target as Element
        const track = target.closest<HTMLElement>('.tc-slider-track')
        if (!track) return

        e.preventDefault()
        this._dragging = true
        this.querySelector('.tc-slider-thumb')?.classList.add('tc-slider-thumb--dragging')
        this._setValue(this._valueFromClientX(e.clientX))
        this._startDrag()
    }

    private _startDrag(): void {
        this._dragMoveHandler = (e: PointerEvent) => {
            if (this.disabled) return
            this._setValue(this._valueFromClientX(e.clientX))
        }
        this._dragUpHandler = () => {
            this.querySelector('.tc-slider-thumb')?.classList.remove('tc-slider-thumb--dragging')
            this._cleanupDrag()
        }
        document.addEventListener('pointermove', this._dragMoveHandler)
        document.addEventListener('pointerup', this._dragUpHandler)
        document.addEventListener('pointercancel', this._dragUpHandler)
    }

    private _cleanupDrag(): void {
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler)
            this._dragMoveHandler = null
        }
        if (this._dragUpHandler) {
            document.removeEventListener('pointerup', this._dragUpHandler)
            document.removeEventListener('pointercancel', this._dragUpHandler)
            this._dragUpHandler = null
        }
        this._dragging = false
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled) return
        const target = e.target as Element
        if (!target.closest('.tc-slider-thumb')) return

        const step = this.step
        const min = this.min
        const max = this.max
        const bigStep = step * 10
        const value = this._currentValue()
        let next: number

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                next = value - step
                break
            case 'ArrowRight':
            case 'ArrowUp':
                next = value + step
                break
            case 'PageDown':
                next = value - bigStep
                break
            case 'PageUp':
                next = value + bigStep
                break
            case 'Home':
                next = min
                break
            case 'End':
                next = max
                break
            default:
                return
        }

        e.preventDefault()
        this._setValue(next)
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('keydown', this._onKeyDown)
    }

    private _detachHandlers(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('keydown', this._onKeyDown)
    }

    private render(): void {
        const min = this.min
        const max = this.max
        const step = this.step
        const value = this._currentValue()

        const label = this.label
        const error = this.error
        // An `error` message forces the invalid state; `state` covers valid/invalid
        // without an accompanying message string.
        const state: SliderState | null = error ? 'invalid' : this.state
        const isInvalid = state === 'invalid'
        const disabled = this.disabled
        const required = this.required
        const ticks = this.ticks
        const showTooltip = this.showTooltip

        const pct = this._pct(value)
        const valueText = this._format(value)

        const labelId = label != null ? `${this._idPrefix}-label` : null
        // The thumb points at the single reserved slot whenever it carries a message.
        const describedById = error || state || this.help ? this._helpId : null

        const labelHtml =
            label != null
                ? `<label class="tc-slider-label" id="${labelId}">${esc(label)}${requiredMark(required)}</label>`
                : ''

        const tooltipHtml = showTooltip
            ? `<div class="tc-slider-tooltip" aria-hidden="true">${esc(valueText)}</div>`
            : ''

        const ticksHtml = (() => {
            if (!ticks) return ''
            const numSteps = max > min ? Math.round((max - min) / step) : 0
            const marks: string[] = []
            for (let i = 0; i <= numSteps; i++) {
                const v = snapToStep(min + i * step, min, max, step)
                marks.push(`<span class="tc-slider-tick" style="left:${this._pct(v)}%"></span>`)
            }
            return `<div class="tc-slider-ticks" aria-hidden="true">${marks.join('')}</div>`
        })()

        const edgeClass =
            pct < 8 ? ' tc-slider-thumb--edge-start' : pct > 92 ? ' tc-slider-thumb--edge-end' : ''
        const thumbAttrs = [
            `class="tc-slider-thumb${edgeClass}"`,
            `role="slider"`,
            `tabindex="${disabled ? -1 : 0}"`,
            `aria-valuemin="${esc(String(min))}"`,
            `aria-valuemax="${esc(String(max))}"`,
            `aria-valuenow="${esc(String(value))}"`,
            `aria-valuetext="${esc(valueText)}"`,
            labelId ? `aria-labelledby="${labelId}"` : '',
            required ? `aria-required="true"` : '',
            isInvalid ? `aria-invalid="true"` : '',
            describedById ? `aria-describedby="${describedById}"` : '',
            `style="left:${pct}%"`,
        ]
            .filter(Boolean)
            .join(' ')

        // One reserved message slot below the track: invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('invalidChoice'),
        })

        patchHtml(
            this,
            [
                labelHtml,
                `<div class="tc-slider-track">`,
                `<div class="tc-slider-fill" style="width:${pct}%"></div>`,
                `<div ${thumbAttrs}>`,
                tooltipHtml,
                `</div>`,
                ticksHtml,
                `</div>`,
                messageHtml,
            ].join(''),
        )

        // The danger track-border recolor is keyed off the invalid state.
        if (isInvalid) this.classList.add('tc-slider--error')
        else this.classList.remove('tc-slider--error')

        if (disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Slider
    }
}

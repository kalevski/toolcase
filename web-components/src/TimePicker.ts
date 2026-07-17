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
import { X, Clock } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-time-picker'

let _tpIdCounter = 0

export type TimePickerFormat = '12h' | '24h'
const FORMATS: TimePickerFormat[] = ['12h', '24h']

export type TimePickerState = 'valid' | 'invalid'
const STATES: TimePickerState[] = ['valid', 'invalid']

type ColumnName = 'hours' | 'minutes' | 'seconds' | 'period'

const clockIconHtml = icon(Clock)
const clearIconHtml = icon(X)

function pad2(n: number): string {
    return String(n).padStart(2, '0')
}

interface ParsedTime {
    h: number
    m: number
    s: number
}

// 24h hour → { displayHour (1-12), period }
function to12h(h: number): { dh: number; period: 'AM' | 'PM' } {
    const period = h < 12 ? 'AM' : 'PM'
    let dh = h % 12
    if (dh === 0) dh = 12
    return { dh, period }
}

// (displayHour 1-12, period) → 24h hour
function from12h(dh: number, period: 'AM' | 'PM'): number {
    if (period === 'AM') return dh % 12
    return (dh % 12) + 12
}

export class TimePicker extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _isOpen = false
    // Shared id for the reserved field-message slot, referenced by aria-describedby.
    private _helpId: string
    private _labelId: string
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null
    private _internals: ElementInternals
    private _defaultValue = ''

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'format',
            'minute-step',
            'show-seconds',
            'label',
            'name',
            'placeholder',
            'required',
            'error',
            'state',
            'help',
            'disabled',
            'clearable',
        ]
    }

    constructor() {
        super()
        const n = ++_tpIdCounter
        this._helpId = `tc-time-picker-help-${n}`
        this._labelId = `tc-time-picker-label-${n}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture the initial value once so formResetCallback can restore it.
            this._defaultValue = this.getAttribute('value') ?? ''
            this.render()
            this._initialised = true
        }
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._removeDocListeners()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue || null
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /** Push value + validity into the form. The submitted value is the canonical
     *  `HH:MM[:SS]` string. Effective invalid = error / state invalid /
     *  required-but-empty. */
    private _syncForm(): void {
        const value = this.value
        const empty = value == null || value === ''
        setFieldFormValue(this._internals, this.name, empty ? null : value)
        const error = this.error
        const requiredEmpty = this.required && empty
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('fieldRequired') : msg('invalidTime')),
            anchor: this._trigger() ?? undefined,
        })
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // value changes are surgically patched so an open panel keeps its
        // focus/scroll state during selection; structural attributes re-render.
        if (name === 'value') {
            this._patchValue()
            this._syncForm()
            return
        }
        if (this._isOpen) this._forceClose()
        this.render()
        // required/state/error all affect the reflected validity computed in _syncForm.
        this._syncForm()
    }

    // ── Attribute-backed props ────────────────────────────────────────────────

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null && v !== '') this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get format(): TimePickerFormat {
        const v = this.getAttribute('format') as TimePickerFormat | null
        return v && FORMATS.includes(v) ? v : '24h'
    }
    set format(v: TimePickerFormat) {
        this.setAttribute('format', v)
    }

    get minuteStep(): number {
        const n = parseInt(this.getAttribute('minute-step') ?? '1', 10) || 1
        return n < 1 ? 1 : n > 30 ? 30 : n
    }
    set minuteStep(v: number) {
        this.setAttribute('minute-step', String(v))
    }

    get showSeconds(): boolean {
        return this.hasAttribute('show-seconds')
    }
    set showSeconds(v: boolean) {
        if (v) this.setAttribute('show-seconds', '')
        else this.removeAttribute('show-seconds')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get placeholder(): string | null {
        return this.getAttribute('placeholder')
    }
    set placeholder(v: string | null) {
        if (v != null) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
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
    get state(): TimePickerState | null {
        const v = this.getAttribute('state') as TimePickerState
        return STATES.includes(v) ? v : null
    }
    set state(v: TimePickerState | null) {
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

    get clearable(): boolean {
        return this.hasAttribute('clearable')
    }
    set clearable(v: boolean) {
        if (v) this.setAttribute('clearable', '')
        else this.removeAttribute('clearable')
    }

    // ── Value parsing / formatting ────────────────────────────────────────────

    private _parseValue(): ParsedTime | null {
        const raw = this.getAttribute('value')
        if (!raw) return null
        const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(raw.trim())
        if (!m) return null
        const h = parseInt(m[1], 10)
        const mi = parseInt(m[2], 10)
        const se = m[3] != null ? parseInt(m[3], 10) : 0
        if (h > 23 || mi > 59 || se > 59) return null
        return { h, m: mi, s: se }
    }

    private _formatDisplay(): string | null {
        const p = this._parseValue()
        if (!p) return null
        const secPart = this.showSeconds ? `:${pad2(p.s)}` : ''
        if (this.format === '12h') {
            const { dh, period } = to12h(p.h)
            return `${pad2(dh)}:${pad2(p.m)}${secPart} ${period}`
        }
        return `${pad2(p.h)}:${pad2(p.m)}${secPart}`
    }

    private _columnOrder(): ColumnName[] {
        const cols: ColumnName[] = ['hours', 'minutes']
        if (this.showSeconds) cols.push('seconds')
        if (this.format === '12h') cols.push('period')
        return cols
    }

    // ── DOM accessors ─────────────────────────────────────────────────────────

    private _trigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-time-picker-trigger')
    }

    private _panel(): HTMLElement | null {
        return this.querySelector('.tc-time-picker-panel')
    }

    // ── Positioning ─────────────────────────────────────────────────────────────

    // Anchors the fixed-positioned panel to the trigger (escapes overflow
    // clipping from ancestor scroll containers). The panel keeps its natural
    // multi-column width — only top/left are set from the trigger.
    private _positionPanel(): void {
        const panel = this.querySelector<HTMLElement>('.tc-time-picker-panel')
        const anchor = this.querySelector<HTMLElement>('.tc-time-picker-trigger')
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

    // ── Open / close ──────────────────────────────────────────────────────────

    private _open(): void {
        if (this._isOpen || this.disabled) return
        this._isOpen = true
        this._trigger()?.setAttribute('aria-expanded', 'true')
        this._panel()?.classList.add('show')

        // Anchor the fixed-positioned panel to the trigger (escapes overflow
        // clipping from ancestor scroll containers), then keep it anchored
        // while the page or an ancestor scrolls/resizes underneath it.
        this._positionPanel()
        this._repositionHandler = () => this._positionPanel()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)

        this._scrollSelectedIntoView()
        // Move focus into the first column's active (or first) option.
        this._focusColumn(this._columnOrder()[0])

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._close(false)
        }
        this._keydownHandler = (e: KeyboardEvent) => this._onKeydown(e)
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._keydownHandler)
    }

    private _close(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._trigger()?.setAttribute('aria-expanded', 'false')
        this._panel()?.classList.remove('show')
        this._removeDocListeners()
        if (refocus) this._trigger()?.focus()
    }

    private _forceClose(): void {
        this._isOpen = false
        this._removeDocListeners()
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

    // ── Keyboard navigation ─────────────────────────────────────────────────────

    private _options(col: ColumnName): HTMLButtonElement[] {
        return Array.from(
            this.querySelectorAll<HTMLButtonElement>(`.tc-time-picker-option[data-col="${col}"]`),
        )
    }

    private _focusColumn(col: ColumnName): void {
        const opts = this._options(col)
        if (opts.length === 0) return
        const active = opts.find((o) => o.classList.contains('tc-time-picker-option--active'))
        ;(active ?? opts[0]).focus()
    }

    private _onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault()
            this._close(true)
            return
        }
        if (e.key === 'Tab') {
            this._close(false)
            return
        }

        const active = document.activeElement
        if (
            !(active instanceof HTMLElement) ||
            !active.classList.contains('tc-time-picker-option') ||
            !this.contains(active)
        ) {
            return
        }
        const col = active.dataset.col as ColumnName | undefined
        if (!col) return

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const opts = this._options(col)
            const idx = opts.indexOf(active as HTMLButtonElement)
            const next =
                e.key === 'ArrowDown' ? Math.min(idx + 1, opts.length - 1) : Math.max(idx - 1, 0)
            opts[next]?.focus()
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            const cols = this._columnOrder()
            const ci = cols.indexOf(col)
            const target =
                e.key === 'ArrowRight'
                    ? cols[Math.min(ci + 1, cols.length - 1)]
                    : cols[Math.max(ci - 1, 0)]
            this._focusColumn(target)
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this._selectOption(active as HTMLButtonElement)
        }
    }

    // ── Selection ───────────────────────────────────────────────────────────────

    private _selectOption(btn: HTMLButtonElement): void {
        const col = btn.dataset.col as ColumnName | undefined
        const raw = btn.dataset.value
        if (!col || raw == null) return

        const parsed = this._parseValue()
        const is12 = this.format === '12h'

        // Working representation, defaulting missing parts to the start of day.
        let dh: number
        let period: 'AM' | 'PM'
        let m: number
        let s: number
        if (parsed) {
            const t = to12h(parsed.h)
            dh = t.dh
            period = t.period
            m = parsed.m
            s = parsed.s
        } else {
            dh = 12
            period = 'AM'
            m = 0
            s = 0
        }
        // For 24h we track the raw hour separately.
        let h = parsed ? parsed.h : 0

        if (col === 'hours') {
            if (is12) dh = parseInt(raw, 10)
            else h = parseInt(raw, 10)
        } else if (col === 'minutes') {
            m = parseInt(raw, 10)
        } else if (col === 'seconds') {
            s = parseInt(raw, 10)
        } else if (col === 'period') {
            period = raw === 'PM' ? 'PM' : 'AM'
        }

        if (is12) h = from12h(dh, period)

        const canonical = `${pad2(h)}:${pad2(m)}${this.showSeconds ? `:${pad2(s)}` : ''}`
        this._commit(canonical)
    }

    private _commit(value: string): void {
        // setAttribute fires attributeChangedCallback('value') → _patchValue() +
        // _syncForm(), which keeps the open panel's focus/scroll intact (no full
        // re-render). When the value is unchanged the callback won't fire, so sync
        // explicitly to cover that path.
        if (this.getAttribute('value') !== value) {
            this.setAttribute('value', value)
        } else {
            this._patchValue()
            this._syncForm()
        }
        dispatchFieldChange(this, value)
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private _clear(): void {
        const had = this._parseValue() != null
        this.removeAttribute('value')
        // removeAttribute fires attributeChangedCallback('value') only when the
        // attribute was present; otherwise patch + sync directly.
        if (!had) {
            this._patchValue()
            this._syncForm()
        }
        if (this._isOpen) this._close(false)
        dispatchFieldChange(this, '')
        if (typeof this.onChange === 'function') this.onChange('')
    }

    // ── Surgical value patch (no full re-render) ────────────────────────────────

    private _patchValue(): void {
        const display = this._formatDisplay()
        const hasValue = display != null
        const placeholder = this.getAttribute('placeholder') || 'Select time'

        const valueEl = this.querySelector<HTMLElement>('.tc-time-picker-value')
        if (valueEl) {
            valueEl.textContent = hasValue ? (display as string) : placeholder
            valueEl.classList.toggle('tc-time-picker-value--placeholder', !hasValue)
        }

        const showClear = this.clearable && hasValue
        const clearBtn = this.querySelector<HTMLButtonElement>('.tc-time-picker-clear')
        if (clearBtn) clearBtn.hidden = !showClear
        const iconEl = this.querySelector<HTMLElement>('.tc-time-picker-icon')
        if (iconEl) iconEl.hidden = showClear

        this._paintOptions()
        if (this._isOpen) this._scrollSelectedIntoView()
    }

    private _paintOptions(): void {
        const parsed = this._parseValue()
        const is12 = this.format === '12h'
        const selHour = parsed ? (is12 ? to12h(parsed.h).dh : parsed.h) : null
        const selMin = parsed ? parsed.m : null
        const selSec = parsed ? parsed.s : null
        const selPeriod = parsed ? to12h(parsed.h).period : null

        this.querySelectorAll<HTMLButtonElement>('.tc-time-picker-option').forEach((btn) => {
            const col = btn.dataset.col as ColumnName
            const raw = btn.dataset.value ?? ''
            let isSel = false
            if (col === 'hours') isSel = selHour != null && parseInt(raw, 10) === selHour
            else if (col === 'minutes') isSel = selMin != null && parseInt(raw, 10) === selMin
            else if (col === 'seconds') isSel = selSec != null && parseInt(raw, 10) === selSec
            else if (col === 'period') isSel = selPeriod === raw
            btn.classList.toggle('tc-time-picker-option--active', isSel)
            btn.setAttribute('aria-selected', isSel ? 'true' : 'false')
        })
    }

    private _scrollSelectedIntoView(): void {
        this._columnOrder().forEach((colName) => {
            const colEl = this.querySelector<HTMLElement>(
                `.tc-time-picker-column[data-col="${colName}"]`,
            )
            if (!colEl) return
            const active = colEl.querySelector<HTMLElement>('.tc-time-picker-option--active')
            if (!active) return
            colEl.scrollTop = active.offsetTop - colEl.clientHeight / 2 + active.clientHeight / 2
        })
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private _renderColumn(col: ColumnName, label: string): string {
        let values: Array<{ raw: string; label: string }>
        if (col === 'hours') {
            const is12 = this.format === '12h'
            const list = is12
                ? Array.from({ length: 12 }, (_, i) => i + 1)
                : Array.from({ length: 24 }, (_, i) => i)
            values = list.map((n) => ({ raw: String(n), label: pad2(n) }))
        } else if (col === 'minutes') {
            const step = this.minuteStep
            const list: number[] = []
            for (let i = 0; i < 60; i += step) list.push(i)
            values = list.map((n) => ({ raw: String(n), label: pad2(n) }))
        } else if (col === 'seconds') {
            values = Array.from({ length: 60 }, (_, i) => ({ raw: String(i), label: pad2(i) }))
        } else {
            values = [
                { raw: 'AM', label: 'AM' },
                { raw: 'PM', label: 'PM' },
            ]
        }

        const opts = values
            .map(
                (v) =>
                    `<button class="tc-time-picker-option" type="button" role="option" aria-selected="false" tabindex="-1" data-col="${col}" data-value="${esc(v.raw)}">${esc(v.label)}</button>`,
            )
            .join('')

        const ariaLabels: Record<ColumnName, string> = {
            hours: 'Hours',
            minutes: 'Minutes',
            seconds: 'Seconds',
            period: 'AM/PM',
        }

        return `<div class="tc-time-picker-column-wrap"><span class="tc-time-picker-column-label" aria-hidden="true">${esc(label)}</span><div class="tc-time-picker-column" role="listbox" aria-label="${esc(ariaLabels[col])}" data-col="${col}">${opts}</div></div>`
    }

    private render(): void {
        const label = this.getAttribute('label')
        const placeholder = this.getAttribute('placeholder') || 'Select time'
        const error = this.getAttribute('error')
        // An `error` message forces the invalid state; `state` covers valid/invalid
        // without an accompanying message string.
        const state: TimePickerState | null = error ? 'invalid' : this.state
        const invalid = state === 'invalid'
        const disabled = this.disabled
        const clearable = this.clearable
        const display = this._formatDisplay()
        const hasValue = display != null
        const showClear = clearable && hasValue

        const required = this.required
        const disabledAttr = disabled ? ' disabled' : ''
        // The trigger points at the single reserved slot whenever it carries a message.
        const describedBy = error || state || this.help ? ` aria-describedby="${this._helpId}"` : ''
        const labelledBy = label != null ? ` aria-labelledby="${this._labelId}"` : ''
        // aria-required on the trigger (the focusable primary control).
        const requiredAttr = required ? ' aria-required="true"' : ''

        const labelHtml =
            label != null
                ? `<label class="tc-time-picker-label form-label" id="${this._labelId}">${esc(label)}${requiredMark(required)}</label>`
                : ''

        const colLabels: Record<ColumnName, string> = {
            hours: 'Hr',
            minutes: 'Min',
            seconds: 'Sec',
            period: '',
        }
        const columnsHtml = this._columnOrder()
            .map((c) => this._renderColumn(c, colLabels[c]))
            .join('')

        const clearHtml = clearable
            ? `<button class="tc-time-picker-clear" type="button" aria-label="Clear time"${showClear ? '' : ' hidden'}>${clearIconHtml}</button>`
            : ''

        const valueClass = hasValue
            ? 'tc-time-picker-value'
            : 'tc-time-picker-value tc-time-picker-value--placeholder'
        const triggerClass = invalid
            ? 'tc-time-picker-trigger form-control is-invalid'
            : 'tc-time-picker-trigger form-control'

        // One reserved message slot below the control: invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('invalidTime'),
            validText: 'Looks good!',
        })

        this.innerHTML = [
            `<div class="tc-time-picker">`,
            labelHtml,
            `<div class="tc-time-picker-control">`,
            `<button class="${triggerClass}" type="button" aria-haspopup="dialog" aria-expanded="false"${labelledBy}${describedBy}${requiredAttr}${disabledAttr}>`,
            `<span class="${valueClass}">${esc(hasValue ? (display as string) : placeholder)}</span>`,
            `</button>`,
            `<span class="tc-time-picker-icon" aria-hidden="true"${showClear ? ' hidden' : ''}>${clockIconHtml}</span>`,
            clearHtml,
            `<div class="tc-time-picker-panel" role="dialog" aria-label="Choose time">${columnsHtml}</div>`,
            `</div>`,
            messageHtml,
            `</div>`,
        ].join('')

        this._paintOptions()
        this._wireEvents()
    }

    private _wireEvents(): void {
        const trigger = this._trigger()
        if (trigger) {
            trigger.addEventListener('click', () => {
                if (this._isOpen) this._close(false)
                else this._open()
            })
        }

        const panel = this._panel()
        if (panel) {
            panel.addEventListener('click', (e: Event) => {
                const opt = (e.target as HTMLElement).closest<HTMLButtonElement>(
                    '.tc-time-picker-option',
                )
                if (opt) this._selectOption(opt)
            })
        }

        const clearBtn = this.querySelector<HTMLButtonElement>('.tc-time-picker-clear')
        if (clearBtn) {
            clearBtn.addEventListener('click', (e: Event) => {
                e.stopPropagation()
                this._clear()
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TimePicker
    }
}

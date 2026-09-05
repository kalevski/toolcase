import { patchHtml } from './internal/patch-html'
import { observeContent } from './internal/content-observer'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import { requiredMark, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-select'

let _idCounter = 0

export type SelectSize = 'sm' | 'lg'
export type SelectState = 'valid' | 'invalid'

const SIZES: SelectSize[] = ['sm', 'lg']
const STATES: SelectState[] = ['valid', 'invalid']

interface OptionData {
    value: string
    label: string
    selected: boolean
    disabled: boolean
}

export class Select extends HTMLElement {
    static formAssociated = true

    private _selectId: string
    private _helpId: string
    private _optionData: OptionData[] = []
    private _renderPending = false
    private _initialised = false
    private _internals: ElementInternals
    private _defaultValue = ''

    static get observedAttributes(): string[] {
        return [
            'value',
            'multiple',
            'size',
            'disabled',
            'required',
            'placeholder',
            'state',
            'label',
            'name',
            'help',
            'error',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._selectId = `tc-select-${uid}`
        this._helpId = `tc-select-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
        }
        this.addEventListener('change', this._onNativeChange)
        // tc-option notifies on its own attributes, which covers a value or a
        // `selected` flag changing. It cannot cover the option's LABEL: that is a
        // text child, and React rewrites it without touching an attribute — so the
        // option list is watched here as well (see content-observer.ts).
        observeContent(this, () => this._scheduleRender())
        this._scheduleRender()
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            this._syncValue(next)
            this._internals.setFormValue(next || null)
            this._syncValidity()
            return
        }
        this.render()
        this._syncValidity()
    }

    formResetCallback(): void {
        this._syncValue(this._defaultValue)
        this._internals.setFormValue(this._defaultValue || null)
        this._syncValidity()
    }

    formDisabledCallback(disabled: boolean): void {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (sel) sel.disabled = disabled
    }

    // Called by tc-option children when they connect or change.
    _scheduleRender(): void {
        if (this._renderPending) return
        this._renderPending = true
        Promise.resolve().then(() => {
            this._renderPending = false
            if (this.isConnected) {
                this.render()
                if (this.multiple) {
                    const fd = new FormData()
                    const name = this.name ?? ''
                    this.values.forEach((v) => fd.append(name, v))
                    this._internals.setFormValue(fd)
                } else {
                    this._internals.setFormValue(this.value || null)
                }
                this._syncValidity()
                this._initialised = true
            }
        })
    }

    get value(): string {
        return (
            this.querySelector<HTMLSelectElement>('select')?.value ??
            this.getAttribute('value') ??
            ''
        )
    }
    set value(v: string) {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (sel) sel.value = v
        this.setAttribute('value', v)
    }

    get values(): string[] {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (!sel) return []
        return Array.from(sel.selectedOptions).map((o) => o.value)
    }
    set values(v: string[]) {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (!sel) return
        const set = new Set(v)
        for (const opt of Array.from(sel.options)) {
            opt.selected = set.has(opt.value)
        }
    }

    get multiple(): boolean {
        return this.hasAttribute('multiple')
    }
    set multiple(v: boolean) {
        if (v) this.setAttribute('multiple', '')
        else this.removeAttribute('multiple')
    }

    get size(): SelectSize | null {
        const v = this.getAttribute('size') as SelectSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: SelectSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
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

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? ''
    }
    set placeholder(v: string) {
        setAttr(this, 'placeholder', v)
    }

    get state(): SelectState | null {
        const v = this.getAttribute('state') as SelectState
        return STATES.includes(v) ? v : null
    }
    set state(v: SelectState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
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

    private _syncValue(next: string | null): void {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (sel) sel.value = next ?? ''
    }

    private _onNativeChange = (): void => {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (!sel) return
        if (this.multiple) {
            const values = Array.from(sel.selectedOptions).map((o) => o.value)
            const fd = new FormData()
            const name = this.name ?? ''
            values.forEach((v) => fd.append(name, v))
            this._internals.setFormValue(fd)
            this._syncValidity()
            // Unified change event: detail.value carries the selected array.
            dispatchFieldChange(this, values)
        } else {
            this.setAttribute('value', sel.value)
            this._internals.setFormValue(sel.value || null)
            this._syncValidity()
            dispatchFieldChange(this, sel.value)
        }
    }

    /** Reflect required/state/error into the form so checkValidity works. */
    private _syncValidity(): void {
        const sel = this.querySelector<HTMLSelectElement>('select')
        const hasValue = this.multiple ? !!sel && sel.selectedOptions.length > 0 : this.value !== ''
        const error = this.error
        const requiredEmpty = this.required && !hasValue
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('selectionRequired') : msg('selectionInvalid')),
            anchor: sel ?? undefined,
        })
    }

    private render(): void {
        const label = this.label
        const size = this.size
        const error = this.error
        // An `error` message forces the invalid state.
        const state: SelectState | null = error ? 'invalid' : this.state
        const multiple = this.multiple
        const disabled = this.disabled
        const existingSel = this.querySelector<HTMLSelectElement>('select')
        const currentValues: string[] = existingSel
            ? Array.from(existingSel.selectedOptions).map((o) => o.value)
            : !multiple && this.getAttribute('value')
              ? [this.getAttribute('value')!]
              : []

        // Snapshot tc-option / native option direct-children whenever they are
        // present. patchHtml steps over them (they are the consumer's, rule 1) so
        // they stay in the light DOM as inert data; _optionData is what the real
        // <select> is built from, and is re-read on every render.
        const hasOptionChildren = Array.from(this.children).some((c) => {
            const t = c.tagName.toLowerCase()
            return t === 'tc-option' || t === 'option'
        })
        if (hasOptionChildren) {
            this._optionData = []
            for (const child of Array.from(this.children)) {
                const t = child.tagName.toLowerCase()
                if (t === 'tc-option') {
                    this._optionData.push({
                        value: child.getAttribute('value') ?? '',
                        label: child.textContent?.trim() ?? '',
                        selected: child.hasAttribute('selected'),
                        disabled: child.hasAttribute('disabled'),
                    })
                } else if (t === 'option') {
                    const opt = child as HTMLOptionElement
                    this._optionData.push({
                        value: opt.value,
                        label: opt.text,
                        selected: opt.defaultSelected,
                        disabled: opt.disabled,
                    })
                }
            }
        }

        const required = this.required
        const placeholder = this.placeholder
        const sizeClass = size ? ` form-select-${size}` : ''
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const requiredAttr = required ? ' required aria-required="true"' : ''
        const multipleAttr = multiple ? ' multiple' : ''

        const labelHtml = label
            ? `<label class="form-label" for="${this._selectId}">${esc(label)}${requiredMark(required)}</label>`
            : ''

        // Placeholder is a disabled, value-less leading option (single-select only),
        // selected when nothing else is.
        const placeholderHtml =
            placeholder && !multiple
                ? `<option value="" disabled${currentValues.length ? '' : ' selected'}>${esc(placeholder)}</option>`
                : ''

        const optionsHtml = this._optionData
            .map((opt) => {
                const sel = opt.selected ? ' selected' : ''
                const dis = opt.disabled ? ' disabled' : ''
                return `<option value="${esc(opt.value)}"${sel}${dis}>${esc(opt.label)}</option>`
            })
            .join('')

        // One reserved slot below the control, used by invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('selectionInvalid'),
            validText: 'Looks good!',
        })
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''

        patchHtml(
            this,
            [
                labelHtml,
                `<select id="${this._selectId}" class="form-select${sizeClass}${stateClass}"${multipleAttr}${disabledAttr}${requiredAttr}${describe}>`,
                placeholderHtml,
                optionsHtml,
                `</select>`,
                messageHtml,
            ].join(''),
        )

        // Restore the selected values from before the re-render.
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (sel && currentValues.length) {
            if (multiple) {
                const set = new Set(currentValues)
                for (const opt of Array.from(sel.options)) {
                    opt.selected = set.has(opt.value)
                }
            } else {
                sel.value = currentValues[0]
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Select
    }
}

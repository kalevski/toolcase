import { esc } from './internal/esc'
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
    private _optionData: OptionData[] = []
    private _renderPending = false
    private _initialised = false
    private _internals: ElementInternals
    private _defaultValue = ''

    static get observedAttributes(): string[] {
        return ['value', 'multiple', 'size', 'disabled', 'state', 'label', 'name']
    }

    constructor() {
        super()
        this._selectId = `tc-select-${++_idCounter}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
        }
        this.addEventListener('change', this._onNativeChange)
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
            return
        }
        this.render()
    }

    formResetCallback(): void {
        this._syncValue(this._defaultValue)
        this._internals.setFormValue(this._defaultValue || null)
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

    private _syncValue(next: string | null): void {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (sel) sel.value = next ?? ''
    }

    private _onNativeChange = (): void => {
        const sel = this.querySelector<HTMLSelectElement>('select')
        if (!sel) return
        if (this.multiple) {
            const values = Array.from(sel.selectedOptions).map((o) => o.value)
            this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, detail: { values } }))
            const fd = new FormData()
            const name = this.name ?? ''
            values.forEach((v) => fd.append(name, v))
            this._internals.setFormValue(fd)
        } else {
            this.setAttribute('value', sel.value)
            this._internals.setFormValue(sel.value || null)
        }
    }

    private render(): void {
        const label = this.label
        const size = this.size
        const state = this.state
        const multiple = this.multiple
        const disabled = this.disabled
        const existingSel = this.querySelector<HTMLSelectElement>('select')
        const currentValues: string[] = existingSel
            ? Array.from(existingSel.selectedOptions).map((o) => o.value)
            : !multiple && this.getAttribute('value')
              ? [this.getAttribute('value')!]
              : []

        // Snapshot tc-option / native option direct-children whenever they are present.
        // After this render they will be destroyed by innerHTML; _optionData persists.
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

        const sizeClass = size ? ` form-select-${size}` : ''
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const multipleAttr = multiple ? ' multiple' : ''

        const labelHtml = label
            ? `<label class="form-label" for="${this._selectId}">${esc(label)}</label>`
            : ''

        const optionsHtml = this._optionData
            .map((opt) => {
                const sel = opt.selected ? ' selected' : ''
                const dis = opt.disabled ? ' disabled' : ''
                return `<option value="${esc(opt.value)}"${sel}${dis}>${esc(opt.label)}</option>`
            })
            .join('')

        const feedbackHtml =
            state === 'valid'
                ? `<div class="valid-feedback">Looks good!</div>`
                : state === 'invalid'
                  ? `<div class="invalid-feedback">Please provide a valid selection.</div>`
                  : ''

        this.innerHTML = [
            labelHtml,
            `<select id="${this._selectId}" class="form-select${sizeClass}${stateClass}"${multipleAttr}${disabledAttr}>`,
            optionsHtml,
            `</select>`,
            feedbackHtml,
        ].join('')

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

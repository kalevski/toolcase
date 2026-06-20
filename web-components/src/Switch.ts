import { esc } from './internal/esc'
const TAG_NAME = 'tc-switch'

let _idCounter = 0

// tc-switch — pill-track switch with a pure-circle sliding knob, paired with an
// optional label. Modelled on the tc-fullscreen-toggle control (button +
// role="switch") rather than the bootstrap form-check: the off track is a crisp
// slate well with a white, shadowed knob (reads as an interactive control), the
// checked track carries the signature 135° slate-ink gradient, and the disabled
// state fades the whole row well past the off state so the two never look alike.
// All cosmetics flow through `--bs-switch-*`.
export class Switch extends HTMLElement {
    static formAssociated = true

    private _inputId: string
    private _labelId: string
    private _initialised = false
    private _internals: ElementInternals
    private _defaultChecked = false
    private _btnEl: HTMLButtonElement | null = null
    private _labelEl: HTMLLabelElement | null = null

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['checked', 'value', 'label', 'disabled', 'reverse', 'name']
    }

    constructor() {
        super()
        const n = ++_idCounter
        this._inputId = `tc-switch-${n}`
        this._labelId = `tc-switch-label-${n}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultChecked = this.hasAttribute('checked')
        }
        this.render()
        this._syncFormValue()
        this._initialised = true
    }

    disconnectedCallback(): void {
        if (this._btnEl) {
            this._btnEl.removeEventListener('click', this._onToggle)
            this._btnEl = null
        }
        if (this._labelEl) {
            this._labelEl.removeEventListener('click', this._onToggle)
            this._labelEl = null
        }
    }

    formResetCallback(): void {
        this.checked = this._defaultChecked
        this._syncFormValue()
    }

    formDisabledCallback(disabled: boolean): void {
        const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
        if (btn) btn.disabled = disabled
        const row = this.querySelector<HTMLElement>('.tc-switch__row')
        if (row) row.classList.toggle('tc-switch__row--disabled', disabled)
    }

    private _syncFormValue(): void {
        if (this.checked) {
            this._internals.setFormValue(this.value || 'on')
        } else {
            this._internals.setFormValue(null)
        }
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch checked/disabled in place — a full re-render would drop the
        // button's focus on every toggle.
        if (name === 'checked') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
            const checked = this.checked
            if (btn) {
                btn.setAttribute('aria-checked', String(checked))
                btn.dataset.checked = String(checked)
            }
            this._syncFormValue()
            return
        }
        if (name === 'disabled') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
            if (btn) btn.disabled = this.disabled
            const row = this.querySelector<HTMLElement>('.tc-switch__row')
            if (row) row.classList.toggle('tc-switch__row--disabled', this.disabled)
            return
        }
        this.render()
    }

    get checked(): boolean {
        return this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get reverse(): boolean {
        return this.hasAttribute('reverse')
    }
    set reverse(v: boolean) {
        if (v) this.setAttribute('reverse', '')
        else this.removeAttribute('reverse')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    private render(): void {
        if (this._btnEl) {
            this._btnEl.removeEventListener('click', this._onToggle)
            this._btnEl = null
        }
        if (this._labelEl) {
            this._labelEl.removeEventListener('click', this._onToggle)
            this._labelEl = null
        }

        const label = this.label
        const checked = this.checked
        const disabled = this.disabled
        const reverse = this.reverse

        const reverseClass = reverse ? ' tc-switch__row--reverse' : ''
        const disabledClass = disabled ? ' tc-switch__row--disabled' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const labelledBy = label != null ? ` aria-labelledby="${this._labelId}"` : ''

        const labelHtml =
            label != null
                ? `<label class="tc-switch__label" id="${this._labelId}" for="${this._inputId}">${esc(label)}</label>`
                : ''

        this.innerHTML = [
            `<div class="tc-switch__row${reverseClass}${disabledClass}">`,
            `<button type="button" id="${this._inputId}" class="tc-switch__track" role="switch" aria-checked="${checked}" data-checked="${checked}"${labelledBy}${disabledAttr}>`,
            `<span class="tc-switch__knob"></span>`,
            `</button>`,
            labelHtml,
            `</div>`,
        ].join('')

        this._btnEl = this.querySelector<HTMLButtonElement>('.tc-switch__track')
        if (this._btnEl) this._btnEl.addEventListener('click', this._onToggle)
        this._labelEl = this.querySelector<HTMLLabelElement>('.tc-switch__label')
        if (this._labelEl) this._labelEl.addEventListener('click', this._onToggle)
    }

    private _onToggle = (): void => {
        if (this.disabled) return
        const next = !this.checked
        this.checked = next // triggers attributeChangedCallback → _syncFormValue
        this.emit('tc-change', { value: next })
        this.dispatchEvent(new Event('input', { bubbles: true }))
        this.dispatchEvent(new Event('change', { bubbles: true }))
        if (typeof this.onChange === 'function') this.onChange(next)
    }

    private emit(type: string, detail: Record<string, unknown>): void {
        this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Switch
    }
}

import { bindOnce, patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
let _formCounter = 0

const TAG_NAME = 'tc-form'

export class Form extends HTMLElement {
    private _initialised = false
    private _formId = ''

    static get observedAttributes(): string[] {
        return ['validated', 'novalidate']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this._render()
        bindOnce(this, 'submit', this._onSubmit)
    }

    disconnectedCallback(): void {
        this.removeEventListener('submit', this._onSubmit)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._render()
    }

    get validated(): boolean {
        return this.hasAttribute('validated')
    }
    set validated(v: boolean) {
        if (v) this.setAttribute('validated', '')
        else this.removeAttribute('validated')
    }

    get novalidate(): boolean {
        return this.hasAttribute('novalidate')
    }
    set novalidate(v: boolean) {
        if (v) this.setAttribute('novalidate', '')
        else this.removeAttribute('novalidate')
    }

    /** Submit-time gate mirroring native constraint validation: runs
     *  `reportValidity()` on the inner form (each invalid control receives an
     *  `invalid` event, which flips toolcase inputs to their submitted state so
     *  inline errors render), toggles the `was-validated` chrome, and returns
     *  overall validity. */
    validate(): boolean {
        const form = this._adoptFields()
        if (!form) return true
        const valid = form.reportValidity()
        if (!valid) {
            form.classList.add('was-validated')
            if (!this.validated) this.setAttribute('validated', '')
        }
        return valid
    }

    /** Return every control to its pristine (no visible errors) state without
     *  touching values — the counterpart of `validate()` for reopening a
     *  dialog or after a successful submit. */
    resetValidity(): void {
        const form = this._adoptFields()
        form?.classList.remove('was-validated')
        this.removeAttribute('validated')
        if (!form) return
        for (const el of Array.from(form.elements)) {
            const ctl = el as Element & { resetValidity?: () => void }
            if (typeof ctl.resetValidity === 'function') ctl.resetValidity()
        }
    }

    private _form(): HTMLFormElement | null {
        return this.querySelector<HTMLFormElement>(':scope > form.tc-form-owner')
    }

    /**
     * Give every control under the host this element's `<form>` as its form owner.
     *
     * The `<form>` is a sibling of the consumer's fields, not a wrapper around them
     * (rule 1) — so ownership is established the way HTML already allows it to be:
     * the `form` content attribute. `form.elements`, `reportValidity()`, `submit`
     * and reset all then behave exactly as they did when the fields were nested.
     */
    private _adoptFields(): HTMLFormElement | null {
        const form = this._form()
        if (!form) return null
        const selector = 'input, select, textarea, button, fieldset, output, [tc-field]'
        for (const el of Array.from(this.querySelectorAll(selector))) {
            if (el.closest('form') !== form) el.setAttribute('form', form.id)
        }
        return form
    }

    /** The `<form>` element stays — it is what gives constraint validation, submit
     *  and reset their behaviour — but it sits BESIDE the consumer's fields and
     *  owns them through the `form` attribute instead of wrapping them (rule 1). */
    private _render(): void {
        setHostClass(this, `tc-form${this.validated ? ' was-validated' : ''}`)
        if (!this._formId) this._formId = `tc-form-${++_formCounter}`
        const novalidateAttr = this.novalidate ? ' novalidate' : ''
        patchHtml(this, `<form class="tc-form-owner" id="${this._formId}"${novalidateAttr}></form>`)
        this._adoptFields()
    }

    private _onSubmit = (event: Event): void => {
        const form = (event.target as HTMLElement)?.closest('form')
        if (form && !form.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            this.classList.add('was-validated')
            if (!this.validated) this.setAttribute('validated', '')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Form
    }
}

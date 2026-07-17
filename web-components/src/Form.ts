const TAG_NAME = 'tc-form'

export class Form extends HTMLElement {
    private _initialised = false
    private _bodyNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['validated', 'novalidate']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes)
            this._initialised = true
        }
        this._render()
        this._reattach()
        this._form()?.addEventListener('submit', this._onSubmit)
    }

    disconnectedCallback(): void {
        this._form()?.removeEventListener('submit', this._onSubmit)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        const form = this._form()
        if (!form) return
        if (name === 'validated') {
            form.classList.toggle('was-validated', this.validated)
        } else if (name === 'novalidate') {
            if (this.novalidate) form.setAttribute('novalidate', '')
            else form.removeAttribute('novalidate')
        }
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
        const form = this._form()
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
        const form = this._form()
        form?.classList.remove('was-validated')
        this.removeAttribute('validated')
        if (!form) return
        for (const el of Array.from(form.elements)) {
            const ctl = el as Element & { resetValidity?: () => void }
            if (typeof ctl.resetValidity === 'function') ctl.resetValidity()
        }
    }

    private _form(): HTMLFormElement | null {
        return this.querySelector('form')
    }

    private _render(): void {
        const classAttr = this.validated ? ' class="was-validated"' : ''
        const novalidateAttr = this.novalidate ? ' novalidate' : ''
        this.innerHTML = `<form${classAttr}${novalidateAttr}><div class="tc-form-body"></div></form>`
    }

    private _reattach(): void {
        const body = this.querySelector('.tc-form-body')
        this._bodyNodes.forEach((n) => body?.appendChild(n))
    }

    private _onSubmit = (event: Event): void => {
        const form = event.currentTarget as HTMLFormElement
        if (!form.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
            form.classList.add('was-validated')
            if (!this.validated) this.setAttribute('validated', '')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Form
    }
}

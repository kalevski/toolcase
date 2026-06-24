const TAG_NAME = 'tc-floating-label'

export class FloatingLabel extends HTMLElement {
    private _control: Element | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'for']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._control = this.firstElementChild
            this._initialised = true
        }
        this.render()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        const lbl = this.querySelector<HTMLLabelElement>('.form-floating > label')
        if (!lbl) {
            this.render()
            return
        }
        if (name === 'label') {
            lbl.textContent = next ?? ''
        } else if (name === 'for') {
            if (next) lbl.setAttribute('for', next)
            else lbl.removeAttribute('for')
        }
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get htmlFor(): string | null {
        return this.getAttribute('for')
    }
    set htmlFor(v: string | null) {
        if (v != null) this.setAttribute('for', v)
        else this.removeAttribute('for')
    }

    private render(): void {
        const control = this._control

        // Bootstrap's float animation requires the control to have a placeholder.
        if (control && !control.hasAttribute('placeholder')) {
            control.setAttribute('placeholder', ' ')
        }

        const wrapper = document.createElement('div')
        wrapper.className = 'form-floating'

        // Move (not clone) the projected control into the wrapper.
        if (control) wrapper.appendChild(control)

        const labelEl = document.createElement('label')
        const forAttr = this.getAttribute('for')
        if (forAttr) labelEl.setAttribute('for', forAttr)
        labelEl.textContent = this.label ?? ''
        wrapper.appendChild(labelEl)

        this.innerHTML = ''
        this.appendChild(wrapper)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FloatingLabel
    }
}

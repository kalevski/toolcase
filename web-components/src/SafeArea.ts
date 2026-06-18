const TAG_NAME = 'tc-safe-area'

export class SafeArea extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['extra']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get extra(): string {
        return this.getAttribute('extra') ?? ''
    }
    set extra(value: string) {
        if (value) this.setAttribute('extra', value)
        else this.removeAttribute('extra')
    }

    private render(): void {
        const extra = this.getAttribute('extra')
        if (extra) {
            this.style.setProperty('--bs-safe-area-extra', extra)
        } else {
            this.style.removeProperty('--bs-safe-area-extra')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SafeArea
    }
}

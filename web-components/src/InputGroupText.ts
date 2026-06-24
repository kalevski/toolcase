const TAG_NAME = 'tc-input-group-text'

export class InputGroupText extends HTMLElement {
    private _initialised = false

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            const span = document.createElement('span')
            span.className = 'input-group-text'
            slotContent.forEach((n) => span.appendChild(n))
            this.innerHTML = ''
            this.appendChild(span)
            this._initialised = true
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InputGroupText
    }
}

import { esc } from './internal/esc'
const TAG_NAME = 'tc-code-label-cell'

export class CodeLabelCell extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['code', 'name']
    }

    constructor() {
        super()
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

    get code(): string {
        return this.getAttribute('code') ?? ''
    }
    set code(v: string) {
        this.setAttribute('code', v)
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        this.setAttribute('name', v)
    }

    private render(): void {
        const code = this.getAttribute('code') ?? ''
        const name = this.getAttribute('name') ?? ''
        this.innerHTML = `<span class="tc-code-label-cell"><code class="tc-code-label-cell-code">${esc(code)}</code><span class="tc-code-label-cell-name">${esc(name)}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CodeLabelCell
    }
}

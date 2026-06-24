import { esc } from './internal/esc'
const TAG_NAME = 'tc-kbd'

export class Kbd extends HTMLElement {
    private _initialised = false
    private _keys: string[] = []

    static get observedAttributes(): string[] {
        return ['class-name', 'separator']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-kbd-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-kbd-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-kbd-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get keys(): string[] {
        return this._keys
    }
    set keys(v: string[]) {
        this._keys = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get separator(): string {
        return this.getAttribute('separator') ?? '+'
    }
    set separator(v: string) {
        this.setAttribute('separator', v)
    }

    // class-name attribute — getter/setter named to avoid conflict with native className
    get extraClass(): string {
        return this.getAttribute('class-name') ?? ''
    }
    set extraClass(v: string) {
        if (v) this.setAttribute('class-name', v)
        else this.removeAttribute('class-name')
    }

    private render(): void {
        const extraClass = this.getAttribute('class-name')
        const wrapperClass = extraClass ? `tc-kbd ${extraClass}` : 'tc-kbd'
        const sep = this.getAttribute('separator') ?? '+'

        if (this._keys.length > 0) {
            const parts = this._keys
                .map((k, i) => {
                    const keyHtml = `<kbd class="tc-kbd-key">${esc(k)}</kbd>`
                    if (i < this._keys.length - 1) {
                        return (
                            keyHtml +
                            `<span class="tc-kbd-sep" aria-hidden="true">${esc(sep)}</span>`
                        )
                    }
                    return keyHtml
                })
                .join('')
            this.innerHTML = `<span class="${wrapperClass}">${parts}</span>`
        } else {
            this.innerHTML = `<span class="${wrapperClass}"><kbd class="tc-kbd-key"><span class="tc-kbd-content"></span></kbd></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Kbd
    }
}

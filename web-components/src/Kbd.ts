import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-kbd'

export class Kbd extends HTMLElement {
    private _initialised = false
    private _keys: string[] = []

    static get observedAttributes(): string[] {
        return ['class-name', 'separator']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        setAttr(this, 'separator', v)
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

        // THE HOST IS THE KEY ROW. With `keys` the chips are element-owned; without
        // it the consumer's own children are the key and `--bare` dresses the host
        // as one, so nothing is ever wrapped or moved (rule 1).
        setHostClass(this, this._keys.length > 0 ? wrapperClass : `${wrapperClass} tc-kbd--bare`)

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
            patchHtml(this, parts)
        } else {
            patchHtml(this, '')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Kbd
    }
}

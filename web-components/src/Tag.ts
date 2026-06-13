import { closeIcon } from './icons'

const TAG_NAME = 'tc-tag'

export type TagVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'

const VARIANTS: TagVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']

export class Tag extends HTMLElement {

    private _initialised = false

    onremove: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['variant', 'removable']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-tag-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-tag-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-tag-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    get variant(): TagVariant {
        const v = this.getAttribute('variant') as TagVariant
        return VARIANTS.includes(v) ? v : 'secondary'
    }
    set variant(v: TagVariant) {
        this.setAttribute('variant', v)
    }

    get removable(): boolean {
        return this.hasAttribute('removable')
    }
    set removable(v: boolean) {
        if (v) this.setAttribute('removable', '')
        else this.removeAttribute('removable')
    }

    private _handleRemove = (): void => {
        this.dispatchEvent(new CustomEvent('tc-remove', {
            bubbles: true,
            composed: true,
        }))
        if (typeof this.onremove === 'function') this.onremove()
    }

    private render(): void {
        const variant = this.variant
        const removable = this.removable

        const removeHtml = removable
            ? `<button type="button" class="tc-tag-remove" aria-label="Remove">${closeIcon}</button>`
            : ''

        this.innerHTML = `<span class="tc-tag tc-tag-${variant}"><span class="tc-tag-content"></span>${removeHtml}</span>`

        if (removable) {
            const btn = this.querySelector('.tc-tag-remove')
            if (btn) btn.addEventListener('click', this._handleRemove)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Tag
    }
}

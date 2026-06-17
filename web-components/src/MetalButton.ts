const TAG_NAME = 'tc-metal-button'

export type MetalButtonVariant = 'default' | 'primary' | 'danger' | 'ghost'
export type MetalButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: MetalButtonVariant[] = ['default', 'primary', 'danger', 'ghost']
const SIZES: MetalButtonSize[] = ['sm', 'md', 'lg']

export class MetalButton extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-metal-button-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-metal-button-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-metal-button-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    get variant(): MetalButtonVariant {
        const v = this.getAttribute('variant') as MetalButtonVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: MetalButtonVariant) {
        this.setAttribute('variant', v)
    }

    get size(): MetalButtonSize {
        const v = this.getAttribute('size') as MetalButtonSize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: MetalButtonSize) {
        this.setAttribute('size', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private render(): void {
        const variant = this.variant
        const size = this.size
        const disabled = this.disabled

        const sizeClass = size !== 'md' ? ` tc-metal-button__btn--${size}` : ''
        const disabledAttr = disabled ? ' disabled' : ''

        this.innerHTML = `<button type="button" class="tc-metal-button__btn tc-metal-button__btn--${variant}${sizeClass}"${disabledAttr}><span class="tc-metal-button-content"></span></button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetalButton
    }
}

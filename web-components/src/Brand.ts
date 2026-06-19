import { esc } from './internal/esc'
const TAG_NAME = 'tc-brand'

export class Brand extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['primary-text', 'secondary-text', 'label', 'color', 'xlarge']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            const primarySlot = Array.from(this.querySelectorAll('[slot="primary"]'))
            const secondarySlot = Array.from(this.querySelectorAll('[slot="secondary"]'))
            const labelSlot = Array.from(this.querySelectorAll('[slot="label"]'))

            this.render()

            // Move named-slot children into their inner regions
            const primaryEl = this.querySelector('.tc-brand__primary')
            if (primaryEl) primarySlot.forEach((n) => primaryEl.appendChild(n))
            const secondaryEl = this.querySelector('.tc-brand__secondary')
            if (secondaryEl) secondarySlot.forEach((n) => secondaryEl.appendChild(n))
            const labelEl = this.querySelector('.tc-brand__label-content')
            if (labelEl) labelSlot.forEach((n) => labelEl.appendChild(n))

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture slot children (by slot attribute) from their containers
        const primarySlot = Array.from(this.querySelectorAll('.tc-brand__primary [slot="primary"]'))
        const secondarySlot = Array.from(
            this.querySelectorAll('.tc-brand__secondary [slot="secondary"]'),
        )
        const labelSlot = Array.from(
            this.querySelectorAll('.tc-brand__label-content [slot="label"]'),
        )

        this.render()

        const primaryEl = this.querySelector('.tc-brand__primary')
        if (primaryEl) primarySlot.forEach((n) => primaryEl.appendChild(n))
        const secondaryEl = this.querySelector('.tc-brand__secondary')
        if (secondaryEl) secondarySlot.forEach((n) => secondaryEl.appendChild(n))
        const labelEl = this.querySelector('.tc-brand__label-content')
        if (labelEl) labelSlot.forEach((n) => labelEl.appendChild(n))
    }

    get primaryText(): string | null {
        return this.getAttribute('primary-text')
    }
    set primaryText(v: string | null) {
        if (v != null) this.setAttribute('primary-text', v)
        else this.removeAttribute('primary-text')
    }

    get secondaryText(): string | null {
        return this.getAttribute('secondary-text')
    }
    set secondaryText(v: string | null) {
        if (v != null) this.setAttribute('secondary-text', v)
        else this.removeAttribute('secondary-text')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get xlarge(): boolean {
        return this.hasAttribute('xlarge')
    }
    set xlarge(v: boolean) {
        if (v) this.setAttribute('xlarge', '')
        else this.removeAttribute('xlarge')
    }

    private render(): void {
        const primaryText = this.getAttribute('primary-text')
        const secondaryText = this.getAttribute('secondary-text')
        const label = this.getAttribute('label')
        const color = this.getAttribute('color')
        const xlarge = this.xlarge

        const xlClass = xlarge ? ' tc-brand--xlarge' : ''
        const colorStyle = color ? ` style="--bs-brand-underline-color: ${esc(color)}"` : ''

        const primaryHtml = primaryText != null ? esc(primaryText) : ''
        const secondaryHtml = secondaryText != null ? esc(secondaryText) : ''
        const labelHtml = label != null ? esc(label) : ''

        this.innerHTML = `<span class="tc-brand${xlClass}"><span class="tc-brand__text-group"${colorStyle}><span class="tc-brand__primary">${primaryHtml}</span><span class="tc-brand__secondary">${secondaryHtml}</span><span class="tc-brand__underline"></span></span><span class="tc-brand__label-content">${labelHtml}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Brand
    }
}

import { esc } from './internal/esc'
const TAG_NAME = 'tc-basic-layout'

export class BasicLayout extends HTMLElement {
    private _initialised = false
    private _brandSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['brand']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named brand-slot children before render() wipes innerHTML
            this._brandSlotNodes = Array.from(this.querySelectorAll('[slot="brand"]'))
            const mainNodes = Array.from(this.childNodes).filter(
                (n) => !(n instanceof Element && n.getAttribute('slot') === 'brand'),
            )

            this.render()

            // Distribute brand slots into the header (only when brand attribute absent)
            if (!this.hasAttribute('brand')) {
                const brandEl = this.querySelector('.tc-basic-layout-brand')
                if (brandEl) this._brandSlotNodes.forEach((n) => brandEl.appendChild(n))
            }

            // Distribute default children into main
            const mainEl = this.querySelector('.tc-basic-layout-main')
            if (mainEl) mainNodes.forEach((n) => mainEl.appendChild(n))

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture brand slot nodes from the header if they were distributed there.
        // When brand attribute was absent before this change, slots lived in
        // .tc-basic-layout-brand; re-capture so they survive the innerHTML wipe.
        const brandEl = this.querySelector('.tc-basic-layout-brand')
        if (brandEl) {
            const inHeader = Array.from(brandEl.querySelectorAll('[slot="brand"]'))
            if (inHeader.length > 0) this._brandSlotNodes = inHeader
        }

        // Re-capture main content before render wipes it
        const mainEl = this.querySelector('.tc-basic-layout-main')
        const mainNodes = mainEl ? Array.from(mainEl.childNodes) : []

        this.render()

        // Re-distribute brand slots (only when brand attribute is absent)
        if (!this.hasAttribute('brand')) {
            const newBrandEl = this.querySelector('.tc-basic-layout-brand')
            if (newBrandEl) this._brandSlotNodes.forEach((n) => newBrandEl.appendChild(n))
        }

        // Re-distribute main content
        const newMainEl = this.querySelector('.tc-basic-layout-main')
        if (newMainEl) mainNodes.forEach((n) => newMainEl.appendChild(n))
    }

    get brand(): string | null {
        return this.getAttribute('brand')
    }
    set brand(v: string | null) {
        if (v != null) this.setAttribute('brand', v)
        else this.removeAttribute('brand')
    }

    private render(): void {
        const brand = this.getAttribute('brand')
        const hasBrand = brand !== null || this._brandSlotNodes.length > 0

        let headerHtml = ''
        if (hasBrand) {
            const brandContent = brand !== null ? esc(brand) : ''
            headerHtml = `<header class="tc-basic-layout-brand">${brandContent}</header>`
        }

        this.innerHTML = `<div class="tc-basic-layout">${headerHtml}<main class="tc-basic-layout-main"></main></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BasicLayout
    }
}

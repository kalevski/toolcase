import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-basic-layout'

export class BasicLayout extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['brand']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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

        // THE HOST IS THE LAYOUT: only an attribute brand is element-owned. A
        // `slot="brand"` child and the page content stay the consumer's own
        // children and are ordered by CSS (rule 1).
        setHostClass(this, 'tc-basic-layout')
        patchHtml(
            this,
            brand !== null ? `<header class="tc-basic-layout-brand">${esc(brand)}</header>` : '',
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BasicLayout
    }
}

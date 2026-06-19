const TAG_NAME = 'tc-visually-hidden'

export type VisuallyHiddenAs = 'span' | 'div'

const AS_TAGS: VisuallyHiddenAs[] = ['span', 'div']

export class VisuallyHidden extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['as']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-visually-hidden-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-visually-hidden-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-visually-hidden-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get as(): VisuallyHiddenAs {
        const v = this.getAttribute('as') as VisuallyHiddenAs
        return AS_TAGS.includes(v) ? v : 'span'
    }
    set as(v: VisuallyHiddenAs) {
        this.setAttribute('as', v)
    }

    private render(): void {
        const tag = this.as
        this.innerHTML = `<${tag} class="visually-hidden"><span class="tc-visually-hidden-content"></span></${tag}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VisuallyHidden
    }
}

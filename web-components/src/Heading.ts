const TAG_NAME = 'tc-heading'

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
const LEVELS: HeadingLevel[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

export class Heading extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['as', 'gradient']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-heading-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-heading-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-heading-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    get as(): HeadingLevel {
        const v = this.getAttribute('as') as HeadingLevel
        return LEVELS.includes(v) ? v : 'h2'
    }
    set as(v: HeadingLevel) {
        this.setAttribute('as', v)
    }

    get gradient(): boolean {
        return this.hasAttribute('gradient')
    }
    set gradient(v: boolean) {
        if (v) this.setAttribute('gradient', '')
        else this.removeAttribute('gradient')
    }

    private render(): void {
        const level = this.as
        const gradientClass = this.gradient ? ' tc-heading--gradient' : ''
        this.innerHTML = `<${level} class="tc-heading${gradientClass}"><span class="tc-heading-content"></span></${level}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Heading
    }
}

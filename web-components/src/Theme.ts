const TAG_NAME = 'tc-theme'

export class Theme extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['name', 'variant']
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }

    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get variant(): string {
        return this.getAttribute('variant') ?? ''
    }

    set variant(v: string) {
        if (v) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Theme
    }
}

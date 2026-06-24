const TAG_NAME = 'tc-theme'

export class Theme extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['name']
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }

    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Theme
    }
}

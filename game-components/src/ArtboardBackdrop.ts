const TAG_NAME = 'gc-artboard-backdrop'

export type ArtboardBackdropKind = 'dark' | 'scene' | 'parch'
export type ArtboardBackdropPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

export class ArtboardBackdrop extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['kind', 'padding']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        if (!this.root.firstChild) {
            this.root.innerHTML = `<slot></slot>`
        }
        if (!this.hasAttribute('kind')) {
            this.setAttribute('kind', 'dark')
        }
        if (!this.hasAttribute('padding')) {
            this.setAttribute('padding', 'md')
        }
    }

    get kind(): ArtboardBackdropKind {
        return (this.getAttribute('kind') as ArtboardBackdropKind) || 'dark'
    }
    set kind(value: ArtboardBackdropKind) {
        this.setAttribute('kind', value)
    }

    get padding(): ArtboardBackdropPadding {
        return (this.getAttribute('padding') as ArtboardBackdropPadding) || 'md'
    }
    set padding(value: ArtboardBackdropPadding) {
        this.setAttribute('padding', value)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ArtboardBackdrop
    }
}

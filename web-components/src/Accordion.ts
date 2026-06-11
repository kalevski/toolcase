const TAG_NAME = 'tc-accordion'

let counter = 0

export class Accordion extends HTMLElement {

    private _accordionId: string

    static get observedAttributes(): string[] {
        return ['flush', 'always-open']
    }

    constructor() {
        super()
        this._accordionId = `tc-accordion-${++counter}`
    }

    connectedCallback(): void {
        if (!this.id) this.id = this._accordionId
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get flush(): boolean {
        return this.hasAttribute('flush')
    }
    set flush(v: boolean) {
        if (v) this.setAttribute('flush', '')
        else this.removeAttribute('flush')
    }

    get alwaysOpen(): boolean {
        return this.hasAttribute('always-open')
    }
    set alwaysOpen(v: boolean) {
        if (v) this.setAttribute('always-open', '')
        else this.removeAttribute('always-open')
    }

    private render(): void {
        this.classList.add('accordion')
        this.classList.toggle('accordion-flush', this.flush)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Accordion
    }
}

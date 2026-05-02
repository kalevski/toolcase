const TAG_NAME = 'gc-divider'

export class Divider extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['no-diamond']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'separator')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get noDiamond(): boolean {
        return this.hasAttribute('no-diamond')
    }
    set noDiamond(v: boolean) {
        if (v) this.setAttribute('no-diamond', '')
        else this.removeAttribute('no-diamond')
    }

    private render(): void {
        const diamond = this.noDiamond
            ? ''
            : `<span class="gc-divider-diamond"></span>`
        this.innerHTML = `<span class="gc-divider-rule"></span>${diamond}<span class="gc-divider-rule"></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Divider
    }
}

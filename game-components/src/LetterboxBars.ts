const TAG_NAME = 'gc-letterbox-bars'

export class LetterboxBars extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['show', 'bar-height', 'bar-color', 'duration']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.firstElementChild) {
            this.innerHTML = `<span class="gc-letterbox-bar gc-letterbox-bar-top"></span><span class="gc-letterbox-bar gc-letterbox-bar-bottom"></span>`
        }
        this.applyTokens()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.applyTokens()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(v: boolean) {
        if (v) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get barHeight(): string {
        return this.getAttribute('bar-height') ?? '80px'
    }
    set barHeight(v: string) {
        if (v) this.setAttribute('bar-height', v)
        else this.removeAttribute('bar-height')
    }

    get barColor(): string {
        return this.getAttribute('bar-color') ?? '#000000'
    }
    set barColor(v: string) {
        if (v) this.setAttribute('bar-color', v)
        else this.removeAttribute('bar-color')
    }

    get duration(): string {
        return this.getAttribute('duration') ?? '0.4s'
    }
    set duration(v: string) {
        if (v) this.setAttribute('duration', v)
        else this.removeAttribute('duration')
    }

    private applyTokens(): void {
        this.style.setProperty('--gc-letterbox-height', this.barHeight)
        this.style.setProperty('--gc-letterbox-color', this.barColor)
        this.style.setProperty('--gc-letterbox-duration', this.duration)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LetterboxBars
    }
}

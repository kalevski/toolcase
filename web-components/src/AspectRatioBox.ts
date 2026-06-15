const TAG_NAME = 'tc-aspect-ratio-box'

export class AspectRatioBox extends HTMLElement {

    private _initialised = false
    private _contentNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['ratio']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._contentNodes = Array.from(this.childNodes)
            this.render()
            this._reattach()
            this._initialised = true
        }
        this._applyRatio()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._applyRatio()
    }

    get ratio(): string {
        return this.getAttribute('ratio') ?? '16 / 9'
    }
    set ratio(value: string) {
        if (value) this.setAttribute('ratio', value)
        else this.removeAttribute('ratio')
    }

    private render(): void {
        this.classList.add('tc-aspect-ratio-box')
        this.innerHTML = `<div class="tc-aspect-ratio-box__content"></div>`
    }

    private _reattach(): void {
        const inner = this.querySelector('.tc-aspect-ratio-box__content')
        if (inner) this._contentNodes.forEach(n => inner.appendChild(n))
    }

    // Drive both the modern `aspect-ratio` value and the padding-bottom
    // fallback percentage through the public `--bs-*` theming contract.
    private _applyRatio(): void {
        const r = this.ratio
        this.style.setProperty('--bs-aspect-ratio-box-ratio', r)
        const parts = r.split(/[\/:]/).map(s => parseFloat(s.trim()))
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            const pct = (parts[1] / parts[0]) * 100
            this.style.setProperty('--bs-aspect-ratio-box-fallback', `${pct.toFixed(4)}%`)
        } else {
            this.style.removeProperty('--bs-aspect-ratio-box-fallback')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AspectRatioBox
    }
}

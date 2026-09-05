import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-aspect-ratio-box'

export class AspectRatioBox extends HTMLElement {
    private _initialised = false
    private _contentNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['ratio']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
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

    /** THE HOST IS THE BOX: it carries the ratio and its direct children fill it,
     *  so nothing the consumer wrote is re-parented into a content div (rule 1). */
    private render(): void {
        setHostClass(this, 'tc-aspect-ratio-box')
    }

    private _reattach(): void {
        const inner = this.querySelector('.tc-aspect-ratio-box__content')
        if (inner) this._contentNodes.forEach((n) => inner.appendChild(n))
    }

    // Drive both the modern `aspect-ratio` value and the padding-bottom
    // fallback percentage through the public `--bs-*` theming contract.
    private _applyRatio(): void {
        const r = this.ratio
        this.style.setProperty('--bs-aspect-ratio-box-ratio', r)
        const parts = r.split(/[\/:]/).map((s) => parseFloat(s.trim()))
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

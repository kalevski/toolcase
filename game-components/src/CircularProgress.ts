const TAG_NAME = 'gc-circular-progress'

export class CircularProgress extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'max', 'size', 'thickness', 'color', 'background', 'show-text', 'reverse']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set value(value: number) {
        this.setAttribute('value', String(value))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 100 : parsed
    }
    set max(value: number) {
        this.setAttribute('max', String(value))
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 64
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 64 : parsed
    }
    set size(value: number) {
        this.setAttribute('size', String(value))
    }

    get thickness(): number {
        const raw = this.getAttribute('thickness')
        if (raw == null) return 6
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 6 : parsed
    }
    set thickness(value: number) {
        this.setAttribute('thickness', String(value))
    }

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get background(): string {
        return this.getAttribute('background') || ''
    }
    set background(value: string) {
        if (value) this.setAttribute('background', value)
        else this.removeAttribute('background')
    }

    get showText(): boolean {
        return this.hasAttribute('show-text')
    }
    set showText(value: boolean) {
        if (value) this.setAttribute('show-text', '')
        else this.removeAttribute('show-text')
    }

    get reverse(): boolean {
        return this.hasAttribute('reverse')
    }
    set reverse(value: boolean) {
        if (value) this.setAttribute('reverse', '')
        else this.removeAttribute('reverse')
    }

    private render(): void {
        const size = this.size
        const thickness = this.thickness
        const max = this.max
        const pct = Math.max(0, Math.min(1, this.value / max))

        const cx = size / 2
        const cy = size / 2
        const r = Math.max(0, (size - thickness) / 2)
        const circumference = 2 * Math.PI * r
        const dashOffset = circumference * (1 - pct)

        this.style.setProperty('--gc-circular-progress-size', `${size}px`)

        const color = this.color
        if (color) this.style.setProperty('--gc-circular-progress-color', color)
        else this.style.removeProperty('--gc-circular-progress-color')

        const background = this.background
        if (background) this.style.setProperty('--gc-circular-progress-bg', background)
        else this.style.removeProperty('--gc-circular-progress-bg')

        const reverseClass = this.reverse ? ' is-reverse' : ''
        const percent = Math.round(pct * 100)

        const textNode = this.showText
            ? `<div class="gc-circular-progress-text">${percent}%</div>`
            : ''

        this.innerHTML = `
            <svg class="gc-circular-progress-svg${reverseClass}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
                <circle cx="${cx}" cy="${cy}" r="${r}" class="gc-circular-progress-track" stroke-width="${thickness}" fill="none"></circle>
                <circle cx="${cx}" cy="${cy}" r="${r}" class="gc-circular-progress-fill" stroke-width="${thickness}" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"></circle>
            </svg>
            ${textNode}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, CircularProgress)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CircularProgress
    }
}

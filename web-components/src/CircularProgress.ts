const TAG_NAME = 'tc-circular-progress'

export class CircularProgress extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'max', 'size', 'thickness', 'color', 'background', 'show-text', 'reverse']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        const thickness = Math.min(this.thickness, size / 2)
        const max = this.max
        const pct = Math.max(0, Math.min(1, this.value / max))

        const cx = size / 2
        const cy = size / 2
        const r = Math.max(0, (size - thickness) / 2)
        const circumference = 2 * Math.PI * r
        const dashOffset = circumference * (1 - pct)
        const percent = Math.round(pct * 100)

        // Host knobs: size and (optional) caller-supplied colors flow through
        // the public --bs-circular-progress-* contract. When the attribute is
        // absent the SCSS default (slate ramp / ink) wins.
        this.style.setProperty('--bs-circular-progress-size', `${size}px`)

        const color = this.color
        if (color) this.style.setProperty('--bs-circular-progress-fill', color)
        else this.style.removeProperty('--bs-circular-progress-fill')

        const background = this.background
        if (background) this.style.setProperty('--bs-circular-progress-track', background)
        else this.style.removeProperty('--bs-circular-progress-track')

        // Progressbar semantics on the host (the SVG itself is decorative).
        this.setAttribute('role', 'progressbar')
        this.setAttribute('aria-valuemin', '0')
        this.setAttribute('aria-valuemax', String(max))
        this.setAttribute('aria-valuenow', String(this.value))
        this.setAttribute('aria-valuetext', `${percent}%`)

        const reverseClass = this.reverse ? ' tc-circular-progress--reverse' : ''
        const textHtml = this.showText
            ? `<span class="tc-circular-progress__text" aria-hidden="true">${percent}%</span>`
            : ''

        this.innerHTML = `
            <span class="tc-circular-progress${reverseClass}">
                <svg class="tc-circular-progress__svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" focusable="false">
                    <circle class="tc-circular-progress__track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${thickness}" fill="none"></circle>
                    <circle class="tc-circular-progress__fill" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${thickness}" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"></circle>
                </svg>
                ${textHtml}
            </span>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CircularProgress
    }
}

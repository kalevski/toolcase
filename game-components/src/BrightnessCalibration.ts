const TAG_NAME = 'gc-brightness-calibration'

export class BrightnessCalibration extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0.5
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0.5 : Math.max(0, Math.min(1, parsed))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private render(): void {
        const value = this.value
        const gamma = (1 - value) * 1.5 + 0.5

        this.style.setProperty('--gc-brightness-gamma', `brightness(${gamma.toFixed(2)})`)

        this.innerHTML = `
            <div class="gc-brightness-calibration-preview">
                <div class="gc-brightness-calibration-band gc-brightness-calibration-dark">
                    <span class="gc-brightness-calibration-label">Should be barely visible</span>
                </div>
                <div class="gc-brightness-calibration-band gc-brightness-calibration-mid">
                    <span class="gc-brightness-calibration-label">Should be clear</span>
                </div>
                <div class="gc-brightness-calibration-band gc-brightness-calibration-bright">
                    <span class="gc-brightness-calibration-label">Should not blow out</span>
                </div>
            </div>
            <div class="gc-brightness-calibration-row">
                <span class="gc-brightness-calibration-row-label">Brightness</span>
                <input type="range" class="gc-brightness-calibration-input" min="0" max="1" step="0.01" value="${value}" />
                <span class="gc-brightness-calibration-row-value">${Math.round(value * 100)}%</span>
            </div>
        `
        const input = this.querySelector('.gc-brightness-calibration-input') as HTMLInputElement | null
        const out = this.querySelector('.gc-brightness-calibration-row-value') as HTMLElement | null
        if (input) {
            input.addEventListener('input', () => {
                const v = parseFloat(input.value)
                if (out) out.textContent = `${Math.round(v * 100)}%`
                this.setAttribute('value', String(v))
                this.emit('change', { value: v })
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BrightnessCalibration
    }
}

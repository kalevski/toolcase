import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-fov-slider'

export class FOVSlider extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'min', 'max']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Field of View')
        super.connectedCallback()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 90
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 90 : parsed
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get min(): number {
        const raw = this.getAttribute('min')
        if (raw == null) return 60
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 60 : parsed
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 120
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 120 : parsed
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    protected renderControl(): string {
        const value = this.value
        const min = this.min
        const max = this.max
        return `
            <div class="gc-setting-row-slider">
                <input type="range" class="gc-setting-row-slider-input" min="${min}" max="${max}" value="${value}" step="1" />
                <span class="gc-setting-row-slider-value">${Math.round(value)}°</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector('.gc-setting-row-slider-input') as HTMLInputElement | null
        const display = this.querySelector('.gc-setting-row-slider-value') as HTMLElement | null
        if (!input) return
        input.addEventListener('input', () => {
            const v = parseFloat(input.value)
            if (display) display.textContent = `${Math.round(v)}°`
            this.setAttribute('value', String(v))
            this.emit('change', { value: v })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, FOVSlider)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FOVSlider
    }
}

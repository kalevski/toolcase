import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-deadzone-slider'

export class DeadzoneSlider extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Stick deadzone')
        super.connectedCallback()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0.15
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0.15 : Math.max(0, Math.min(1, parsed))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    protected renderControl(): string {
        const value = this.value
        return `
            <div class="gc-setting-row-slider">
                <input type="range" class="gc-setting-row-slider-input" min="0" max="1" step="0.01" value="${value}" />
                <span class="gc-setting-row-slider-value">${Math.round(value * 100)}%</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector('.gc-setting-row-slider-input') as HTMLInputElement | null
        const display = this.querySelector('.gc-setting-row-slider-value') as HTMLElement | null
        if (!input) return
        input.addEventListener('input', () => {
            const v = parseFloat(input.value)
            if (display) display.textContent = `${Math.round(v * 100)}%`
            this.setAttribute('value', String(v))
            this.emit('change', { value: v })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DeadzoneSlider
    }
}

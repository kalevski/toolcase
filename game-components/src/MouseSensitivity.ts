import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-mouse-sensitivity'

export class MouseSensitivity extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'ads']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Mouse sensitivity')
        super.connectedCallback()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 1
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 1 : parsed
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get ads(): number | null {
        const raw = this.getAttribute('ads')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set ads(v: number | null) {
        if (v == null) this.removeAttribute('ads')
        else this.setAttribute('ads', String(v))
    }

    protected renderControl(): string {
        const main = this.value
        const ads = this.ads
        const adsRow = ads != null ? `
            <div class="gc-setting-row-mouse-row">
                <span class="gc-setting-row-mouse-key">ADS</span>
                <input type="range" class="gc-setting-row-slider-input" data-key="ads" min="0.1" max="5" step="0.05" value="${ads}" />
                <span class="gc-setting-row-slider-value" data-key="ads">${ads.toFixed(2)}</span>
            </div>
        ` : ''
        return `
            <div class="gc-setting-row-mouse">
                <div class="gc-setting-row-mouse-row">
                    <span class="gc-setting-row-mouse-key">Main</span>
                    <input type="range" class="gc-setting-row-slider-input" data-key="main" min="0.1" max="5" step="0.05" value="${main}" />
                    <span class="gc-setting-row-slider-value" data-key="main">${main.toFixed(2)}</span>
                </div>
                ${adsRow}
            </div>
        `
    }

    protected bindControl(): void {
        const inputs = this.querySelectorAll('.gc-setting-row-slider-input') as NodeListOf<HTMLInputElement>
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const key = input.dataset.key ?? 'main'
                const v = parseFloat(input.value)
                const display = this.querySelector(`.gc-setting-row-slider-value[data-key="${key}"]`) as HTMLElement | null
                if (display) display.textContent = v.toFixed(2)
                if (key === 'main') this.setAttribute('value', String(v))
                else this.setAttribute('ads', String(v))
                this.emit('change', { key, value: v })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MouseSensitivity
    }
}

import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-volume-slider'

export class VolumeSlider extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'muted']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Volume')
        super.connectedCallback()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0.8
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0.8 : Math.max(0, Math.min(1, parsed))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get muted(): boolean {
        return this.hasAttribute('muted')
    }
    set muted(v: boolean) {
        if (v) this.setAttribute('muted', '')
        else this.removeAttribute('muted')
    }

    protected renderControl(): string {
        const value = this.value
        const muted = this.muted
        const glyph = muted ? '🔇' : '🔊'
        return `
            <div class="gc-setting-row-slider gc-setting-row-volume">
                <button type="button" class="gc-setting-row-mute" aria-label="Toggle mute">${glyph}</button>
                <input type="range" class="gc-setting-row-slider-input" min="0" max="1" step="0.01" value="${value}" ${muted ? 'disabled' : ''} />
                <span class="gc-setting-row-slider-value">${Math.round(value * 100)}%</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector('.gc-setting-row-slider-input') as HTMLInputElement | null
        const display = this.querySelector('.gc-setting-row-slider-value') as HTMLElement | null
        const muteBtn = this.querySelector('.gc-setting-row-mute') as HTMLButtonElement | null
        if (input) {
            input.addEventListener('input', () => {
                const v = parseFloat(input.value)
                if (display) display.textContent = `${Math.round(v * 100)}%`
                this.setAttribute('value', String(v))
                this.emit('change', { value: v })
            })
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                this.emit('toggle-mute')
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VolumeSlider
    }
}

import { SettingRowBase } from './SettingRowBase'
import { icon } from './icons'
import { Volume2, VolumeX } from 'lucide-static'

const TAG_NAME = 'tc-volume-slider'

// Pre-computed at module load — always rendered so no conditional resolve needed.
const volumeOnIcon = icon(Volume2)
const volumeOffIcon = icon(VolumeX)

// tc-volume-slider — a volume range-slider setting row. A mute toggle button,
// a native range input (0–1, 1% steps), and a mono percentage readout, built
// on the shared setting-row scaffold. Port of game-components `gc-volume-slider`
// with the fantasy chrome dropped for the toolcase slate/ink look.

export class VolumeSlider extends SettingRowBase {

    // Optional callback mirrors of tc-change / tc-toggle-mute events.
    onChange: ((value: number) => void) | null = null
    onToggleMute: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'muted', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Volume')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        // Patch value in place — avoids destroying the active input element
        // (and any in-progress drag) on every `input` event.
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('.tc-volume-slider__input')
            const display = this.querySelector<HTMLElement>('.tc-volume-slider__value')
            const v = this.value
            if (input && input.value !== String(v)) input.value = String(v)
            if (display) display.textContent = `${Math.round(v * 100)}%`
            return
        }

        // Patch muted in place — swap icon and toggle the input's disabled state
        // without destroying the whole control region.
        if (name === 'muted') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-volume-slider__mute-btn')
            const input = this.querySelector<HTMLInputElement>('.tc-volume-slider__input')
            const muted = this.muted
            if (btn) {
                btn.innerHTML = muted ? volumeOffIcon : volumeOnIcon
                btn.setAttribute('aria-pressed', String(muted))
            }
            if (input) {
                if (muted || this.disabled) input.setAttribute('disabled', '')
                else input.removeAttribute('disabled')
            }
            return
        }

        // `disabled` is structural (affects button + input) — fall through to
        // the base full re-render.
        super.attributeChangedCallback(name, old, next)
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

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    protected renderControl(): string {
        const value = this.value
        const muted = this.muted
        const disabled = this.disabled
        const inputDisabledAttr = muted || disabled ? ' disabled' : ''
        const btnDisabledAttr = disabled ? ' disabled' : ''
        const muteIconHtml = muted ? volumeOffIcon : volumeOnIcon
        return `
            <div class="tc-volume-slider__control">
                <button
                    type="button"
                    class="tc-volume-slider__mute-btn"
                    aria-label="Toggle mute"
                    aria-pressed="${muted}"${btnDisabledAttr}
                >${muteIconHtml}</button>
                <input
                    type="range"
                    class="tc-volume-slider__input"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${value}"
                    aria-label="${this.escape(this.rowLabel)}"${inputDisabledAttr}
                />
                <span class="tc-volume-slider__value">${Math.round(value * 100)}%</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector<HTMLInputElement>('.tc-volume-slider__input')
        const display = this.querySelector<HTMLElement>('.tc-volume-slider__value')
        const muteBtn = this.querySelector<HTMLButtonElement>('.tc-volume-slider__mute-btn')

        if (input) {
            input.addEventListener('input', () => {
                const v = parseFloat(input.value)
                if (display) display.textContent = `${Math.round(v * 100)}%`
                this.setAttribute('value', String(v))
                this.emit('tc-change', { value: v })
                if (typeof this.onChange === 'function') this.onChange(v)
            })
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                this.emit('tc-toggle-mute', {})
                if (typeof this.onToggleMute === 'function') this.onToggleMute()
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VolumeSlider
    }
}

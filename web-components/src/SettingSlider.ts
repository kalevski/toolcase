import { SettingRowBase } from './SettingRowBase'
import { icon } from './icons'
import { Volume2, VolumeX } from 'lucide-static'

const TAG_NAME = 'tc-setting-slider'

// Pre-computed at module load — only injected when `with-mute` is set.
const volumeOnIcon = icon(Volume2)
const volumeOffIcon = icon(VolumeX)

type SliderFormat = 'percent' | 'int' | 'float'

interface SliderDefaults {
    rowLabel?: string
    min?: number
    max?: number
    step?: number
    value?: number
    unit?: string
    format?: SliderFormat
    withMute?: boolean
}

// Per-tag defaults for the preset aliases. tc-volume-slider / tc-deadzone-slider
// / tc-fov-slider derive their range, default value, readout format and (for
// volume) the mute button from the tag they were defined as, so legacy markup
// keeps working without spelling out every attribute. The canonical
// tc-setting-slider tag falls back to the generic 0–100 integer slider.
const TAG_DEFAULTS: Record<string, SliderDefaults> = {
    'tc-volume-slider': {
        rowLabel: 'Volume',
        min: 0,
        max: 1,
        step: 0.01,
        value: 0.8,
        format: 'percent',
        withMute: true,
    },
    'tc-deadzone-slider': {
        rowLabel: 'Stick deadzone',
        min: 0,
        max: 1,
        step: 0.01,
        value: 0.15,
        format: 'percent',
    },
    'tc-fov-slider': {
        rowLabel: 'Field of View',
        min: 60,
        max: 120,
        step: 1,
        value: 90,
        format: 'int',
        unit: '°',
    },
}

/**
 * tc-setting-slider — a generic range-slider setting row on the shared
 * SettingRowBase scaffold: a native `<input type="range">` paired with a mono
 * readout, plus an optional mute button. The readout format is driven by
 * `format` (`percent` renders `value × 100 %`; `int` / `float` append `unit`).
 *
 * tc-volume-slider (with mute, percent), tc-deadzone-slider (percent) and
 * tc-fov-slider (integer degrees) are aliases of this element that seed their
 * defaults from the tag name.
 */
export class SettingSlider extends SettingRowBase {

    // Optional callback mirrors of the tc-change / tc-toggle-mute events.
    onChange: ((value: number) => void) | null = null
    onToggleMute: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            ...SettingRowBase.observedAttributes,
            'value',
            'min',
            'max',
            'step',
            'unit',
            'format',
            'with-mute',
            'muted',
            'disabled',
        ]
    }

    connectedCallback(): void {
        const presetLabel = TAG_DEFAULTS[this.localName]?.rowLabel
        if (presetLabel && !this.hasAttribute('row-label')) {
            this.setAttribute('row-label', presetLabel)
        }
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        // Patch value in place — avoids destroying the active input element
        // (and any in-progress drag) on every `input` event.
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('.tc-setting-slider__input')
            const display = this.querySelector<HTMLElement>('.tc-setting-slider__value')
            const v = this.value
            if (input && input.value !== String(v)) input.value = String(v)
            if (display) display.textContent = this.formatValue(v)
            return
        }

        // Patch muted in place — swap icon and toggle the input's disabled state
        // without destroying the whole control region.
        if (name === 'muted') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-setting-slider__mute-btn')
            const input = this.querySelector<HTMLInputElement>('.tc-setting-slider__input')
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

        // Everything else is structural (range bounds, format, mute presence,
        // disabled) — fall through to the base full re-render.
        super.attributeChangedCallback(name, old, next)
    }

    private get defaults(): SliderDefaults {
        return TAG_DEFAULTS[this.localName] ?? {}
    }

    private numAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? fallback : parsed
    }

    get min(): number {
        return this.numAttr('min', this.defaults.min ?? 0)
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        return this.numAttr('max', this.defaults.max ?? 100)
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get step(): number {
        return this.numAttr('step', this.defaults.step ?? 1)
    }
    set step(v: number) {
        this.setAttribute('step', String(v))
    }

    get value(): number {
        const fallback = this.defaults.value ?? this.min
        const v = this.numAttr('value', fallback)
        return Math.max(this.min, Math.min(this.max, v))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get unit(): string {
        return this.getAttribute('unit') ?? this.defaults.unit ?? ''
    }
    set unit(v: string) {
        this.setAttribute('unit', v)
    }

    get format(): SliderFormat {
        return (this.getAttribute('format') as SliderFormat) ?? this.defaults.format ?? 'int'
    }
    set format(v: SliderFormat) {
        this.setAttribute('format', v)
    }

    get withMute(): boolean {
        return this.hasAttribute('with-mute') || this.defaults.withMute === true
    }
    set withMute(v: boolean) {
        if (v) this.setAttribute('with-mute', '')
        else this.removeAttribute('with-mute')
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

    private formatValue(v: number): string {
        switch (this.format) {
            case 'percent':
                return `${Math.round(v * 100)}%`
            case 'float':
                return `${v}${this.unit}`
            case 'int':
            default:
                return `${Math.round(v)}${this.unit}`
        }
    }

    protected renderControl(): string {
        const value = this.value
        const disabled = this.disabled
        const withMute = this.withMute
        const muted = this.muted
        const inputDisabledAttr = (withMute && muted) || disabled ? ' disabled' : ''
        const btnDisabledAttr = disabled ? ' disabled' : ''

        const muteBtn = withMute
            ? `<button
                    type="button"
                    class="tc-setting-slider__mute-btn"
                    aria-label="Toggle mute"
                    aria-pressed="${muted}"${btnDisabledAttr}
                >${muted ? volumeOffIcon : volumeOnIcon}</button>`
            : ''

        return `
            <div class="tc-setting-slider__control">
                ${muteBtn}
                <input
                    type="range"
                    class="tc-setting-slider__input"
                    min="${this.min}"
                    max="${this.max}"
                    step="${this.step}"
                    value="${value}"
                    aria-label="${this.escape(this.rowLabel)}"${inputDisabledAttr}
                />
                <span class="tc-setting-slider__value">${this.formatValue(value)}</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector<HTMLInputElement>('.tc-setting-slider__input')
        const display = this.querySelector<HTMLElement>('.tc-setting-slider__value')
        const muteBtn = this.querySelector<HTMLButtonElement>('.tc-setting-slider__mute-btn')

        if (input) {
            input.addEventListener('input', () => {
                const v = parseFloat(input.value)
                if (display) display.textContent = this.formatValue(v)
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
        [TAG_NAME]: SettingSlider
        'tc-volume-slider': SettingSlider
        'tc-deadzone-slider': SettingSlider
        'tc-fov-slider': SettingSlider
    }
}

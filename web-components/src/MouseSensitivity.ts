import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-mouse-sensitivity'

// tc-mouse-sensitivity — a mouse-sensitivity preset row. Two native range inputs
// (main + optional ADS) spanning 0.1–5 with 0.05 steps, each paired with a mono
// decimal readout. Built on the shared setting-row scaffold. Port of
// game-components `gc-mouse-sensitivity` with the fantasy chrome dropped for the
// toolcase slate/ink look.

export class MouseSensitivity extends SettingRowBase {
    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((key: 'main' | 'ads', value: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'ads', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Mouse sensitivity')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        // Patch value in place — avoids destroying the active input element
        // (and any in-progress drag) on every `input` event.
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>(
                '.tc-mouse-sensitivity__input[data-key="main"]',
            )
            const display = this.querySelector<HTMLElement>(
                '.tc-mouse-sensitivity__value[data-key="main"]',
            )
            const v = this.value
            if (input && input.value !== String(v)) input.value = String(v)
            if (display) display.textContent = v.toFixed(2)
            return
        }

        if (name === 'ads') {
            const adsRow = this.querySelector('.tc-mouse-sensitivity__row--ads')
            const newAds = this.ads
            if (newAds !== null && adsRow !== null) {
                // Row already visible and stays visible — patch in place.
                const input = this.querySelector<HTMLInputElement>(
                    '.tc-mouse-sensitivity__input[data-key="ads"]',
                )
                const display = this.querySelector<HTMLElement>(
                    '.tc-mouse-sensitivity__value[data-key="ads"]',
                )
                if (input && input.value !== String(newAds)) input.value = String(newAds)
                if (display) display.textContent = newAds.toFixed(2)
                return
            }
            // ADS row appeared or disappeared — fall through to full re-render.
        }

        super.attributeChangedCallback(name, old, next)
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

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    protected renderControl(): string {
        const main = this.value
        const ads = this.ads
        const disabledAttr = this.disabled ? ' disabled' : ''
        const adsRow =
            ads != null
                ? `
            <div class="tc-mouse-sensitivity__row tc-mouse-sensitivity__row--ads">
                <span class="tc-mouse-sensitivity__key">ADS</span>
                <input
                    type="range"
                    class="tc-mouse-sensitivity__input"
                    data-key="ads"
                    min="0.1"
                    max="5"
                    step="0.05"
                    value="${ads}"
                    aria-label="ADS sensitivity"${disabledAttr}
                />
                <span class="tc-mouse-sensitivity__value" data-key="ads">${ads.toFixed(2)}</span>
            </div>
        `
                : ''
        return `
            <div class="tc-mouse-sensitivity__control">
                <div class="tc-mouse-sensitivity__row">
                    <span class="tc-mouse-sensitivity__key">Main</span>
                    <input
                        type="range"
                        class="tc-mouse-sensitivity__input"
                        data-key="main"
                        min="0.1"
                        max="5"
                        step="0.05"
                        value="${main}"
                        aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
                    />
                    <span class="tc-mouse-sensitivity__value" data-key="main">${main.toFixed(2)}</span>
                </div>
                ${adsRow}
            </div>
        `
    }

    protected bindControl(): void {
        const inputs = this.querySelectorAll<HTMLInputElement>('.tc-mouse-sensitivity__input')
        inputs.forEach((input) => {
            input.addEventListener('input', () => {
                const key = (input.dataset.key ?? 'main') as 'main' | 'ads'
                const v = parseFloat(input.value)
                const display = this.querySelector<HTMLElement>(
                    `.tc-mouse-sensitivity__value[data-key="${key}"]`,
                )
                if (display) display.textContent = v.toFixed(2)
                if (key === 'main') this.setAttribute('value', String(v))
                else this.setAttribute('ads', String(v))
                this.emit('tc-change', { key, value: v })
                if (typeof this.onChange === 'function') this.onChange(key, v)
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MouseSensitivity
    }
}

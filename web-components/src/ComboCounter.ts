const TAG_NAME = 'tc-combo-counter'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class ComboCounter extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['combo', 'label', 'timer', 'font-size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // role=status + aria-live so combo changes are announced to assistive tech.
            this.setAttribute('role', 'status')
            this.setAttribute('aria-live', 'polite')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get combo(): number {
        const raw = this.getAttribute('combo')
        if (raw == null) return 0
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set combo(value: number) {
        this.setAttribute('combo', String(value))
    }

    get label(): string {
        return this.getAttribute('label') || 'Combo'
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get timer(): number | null {
        const raw = this.getAttribute('timer')
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set timer(value: number | null) {
        if (value == null) this.removeAttribute('timer')
        else this.setAttribute('timer', String(value))
    }

    get fontSize(): number {
        const raw = this.getAttribute('font-size')
        if (raw == null) return 36
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 36 : parsed
    }
    set fontSize(value: number) {
        this.setAttribute('font-size', String(value))
    }

    private render(): void {
        const combo = this.combo
        // The HUD readout only appears once a multiplier has started building (x2+).
        const visible = combo > 1
        if (visible) this.setAttribute('data-visible', '')
        else this.removeAttribute('data-visible')

        // Caller-controlled value figure size, exposed through the theming contract.
        this.style.setProperty('--bs-combo-counter-value-size', `${this.fontSize}px`)

        if (!visible) {
            this.innerHTML = ''
            return
        }

        const timer = this.timer
        const showBar = timer !== null
        const pct = showBar ? Math.max(0, Math.min(1, timer as number)) * 100 : 0

        const barNode = showBar
            ? `<span class="tc-combo-counter-bar" aria-hidden="true"><span class="tc-combo-counter-bar-fill" style="width:${pct}%"></span></span>`
            : ''

        this.innerHTML = [
            '<div class="tc-combo-counter">',
            `<span class="tc-combo-counter-eyebrow">${esc(this.label)}</span>`,
            `<span class="tc-combo-counter-value">x${combo}</span>`,
            barNode,
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ComboCounter
    }
}

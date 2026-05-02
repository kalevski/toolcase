const TAG_NAME = 'gc-combo-counter'

export class ComboCounter extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['combo', 'label', 'timer', 'font-size']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
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
        const visible = combo > 1
        if (visible) this.setAttribute('data-visible', '')
        else this.removeAttribute('data-visible')

        this.style.setProperty('--gc-combo-counter-font-size', `${this.fontSize}px`)

        if (!visible) {
            this.innerHTML = ''
            return
        }

        const timer = this.timer
        const showBar = timer !== null
        const pct = showBar ? Math.max(0, Math.min(1, timer as number)) * 100 : 0

        const barNode = showBar
            ? `<span class="gc-combo-counter-bar"><span class="gc-combo-counter-bar-fill" style="width:${pct}%"></span></span>`
            : ''

        this.innerHTML = `
            <span class="gc-combo-counter-eyebrow">${this.escape(this.label)}</span>
            <span class="gc-combo-counter-value">x${combo}</span>
            ${barNode}
        `
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ComboCounter)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ComboCounter
    }
}

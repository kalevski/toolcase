const TAG_NAME = 'gc-score-display'

export type ScoreDisplayAlign = 'left' | 'right' | 'center'

export class ScoreDisplay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['score', 'multiplier', 'label', 'align', 'font-size']
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

    get score(): number {
        const raw = this.getAttribute('score')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set score(value: number) {
        this.setAttribute('score', String(value))
    }

    get multiplier(): number | null {
        const raw = this.getAttribute('multiplier')
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set multiplier(value: number | null) {
        if (value == null) this.removeAttribute('multiplier')
        else this.setAttribute('multiplier', String(value))
    }

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get align(): ScoreDisplayAlign {
        return (this.getAttribute('align') as ScoreDisplayAlign) || 'left'
    }
    set align(value: ScoreDisplayAlign) {
        this.setAttribute('align', value)
    }

    get fontSize(): number {
        const raw = this.getAttribute('font-size')
        if (raw == null) return 28
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 28 : parsed
    }
    set fontSize(value: number) {
        this.setAttribute('font-size', String(value))
    }

    private render(): void {
        const align = this.align
        this.dataset.align = align
        this.style.setProperty('--gc-score-display-font-size', `${this.fontSize}px`)

        const label = this.label
        const score = this.score
        const multiplier = this.multiplier
        const showMultiplier = multiplier !== null && multiplier !== 1

        const labelNode = label
            ? `<span class="gc-score-display-label">${this.escape(label)}</span>`
            : ''

        const multiplierNode = showMultiplier
            ? `<span class="gc-score-display-multiplier">×${multiplier}</span>`
            : ''

        this.innerHTML = `
            ${labelNode}
            <span class="gc-score-display-row">
                <span class="gc-score-display-value">${score.toLocaleString()}</span>
                ${multiplierNode}
            </span>
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

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScoreDisplay
    }
}

import { esc } from './internal/esc'
const TAG_NAME = 'tc-score-display'

export type ScoreDisplayAlign = 'left' | 'right' | 'center'
const ALIGNS: ScoreDisplayAlign[] = ['left', 'right', 'center']

export class ScoreDisplay extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['score', 'multiplier', 'label', 'align', 'font-size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        return this.getAttribute('label') ?? ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get align(): ScoreDisplayAlign {
        const raw = this.getAttribute('align') as ScoreDisplayAlign
        return ALIGNS.includes(raw) ? raw : 'left'
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
        const label = this.label
        const score = this.score
        const multiplier = this.multiplier
        const showMultiplier = multiplier !== null && multiplier !== 1

        this.classList.add('tc-score-display')
        this.dataset.align = this.align
        this.style.setProperty('--bs-score-display-font-size', `${this.fontSize}px`)

        const labelHtml = label ? `<span class="tc-score-display-label">${esc(label)}</span>` : ''

        const multiplierHtml = showMultiplier
            ? `<span class="tc-score-display-multiplier">×${multiplier}</span>`
            : ''

        this.innerHTML = [
            labelHtml,
            '<div class="tc-score-display-row">',
            `<span class="tc-score-display-value">${score.toLocaleString()}</span>`,
            multiplierHtml,
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScoreDisplay
    }
}

import { patchHtml } from './internal/patch-html'
import { escapeHtml, renderResourceBarTrack } from './internal/resourceBar'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-boss-bar'

export class BossBar extends HTMLElement {
    private _initialised = false
    private _phaseTicks: number[] = []

    static get observedAttributes(): string[] {
        return ['name', 'epithet', 'phase', 'hp', 'hp-max']
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

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        setAttr(this, 'name', v)
    }

    get epithet(): string {
        return this.getAttribute('epithet') ?? ''
    }
    set epithet(v: string) {
        setAttr(this, 'epithet', v)
    }

    get phase(): number {
        const raw = this.getAttribute('phase')
        if (raw == null) return 1
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 1 : parsed
    }
    set phase(v: number) {
        this.setAttribute('phase', String(v))
    }

    get hp(): number {
        const raw = this.getAttribute('hp')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set hp(v: number) {
        this.setAttribute('hp', String(v))
    }

    get hpMax(): number {
        const raw = this.getAttribute('hp-max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 100 : parsed
    }
    set hpMax(v: number) {
        this.setAttribute('hp-max', String(v))
    }

    get phaseTicks(): number[] {
        return this._phaseTicks.slice()
    }
    set phaseTicks(values: number[]) {
        this._phaseTicks = Array.isArray(values) ? values.slice() : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const name = this.name
        const epithet = this.epithet
        const phase = this.phase
        const hp = this.hp
        const hpMax = this.hpMax

        // Component-owned host class via classList so author-supplied classes survive.
        this.classList.add('tc-boss-bar')

        const epithetMarkup = epithet
            ? `<span class="tc-boss-bar__epithet">${escapeHtml(epithet)}</span>`
            : ''

        const track = renderResourceBarTrack({
            prefix: 'tc-boss-bar',
            value: hp,
            max: hpMax,
            ticks: this._phaseTicks,
            label: name || 'Boss health',
        })

        patchHtml(
            this,
            `<div class="tc-boss-bar__header">` +
                `<span class="tc-boss-bar__name">${escapeHtml(name)}</span>` +
                epithetMarkup +
                `<span class="tc-boss-bar__phase">Phase ${phase}</span>` +
                `</div>` +
                track +
                `<div class="tc-boss-bar__numeric">${Math.round(hp)} / ${Math.round(hpMax)}</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BossBar
    }
}

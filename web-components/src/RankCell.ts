const TAG_NAME = 'tc-rank-cell'

type RankCellTier = 'gold' | 'silver' | 'bronze' | 'default'

function resolveTier(rank: number): RankCellTier {
    if (rank === 1) return 'gold'
    if (rank === 2) return 'silver'
    if (rank === 3) return 'bronze'
    return 'default'
}

export class RankCell extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['rank', 'pad']
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

    get rank(): number {
        return parseInt(this.getAttribute('rank') ?? '0', 10) || 0
    }
    set rank(v: number) {
        this.setAttribute('rank', String(v))
    }

    get pad(): number {
        const raw = this.getAttribute('pad')
        const parsed = raw !== null ? parseInt(raw, 10) : NaN
        return isNaN(parsed) || parsed < 1 ? 2 : parsed
    }
    set pad(v: number) {
        this.setAttribute('pad', String(v))
    }

    private render(): void {
        const rank = this.rank
        const pad = this.pad
        const tier = resolveTier(rank)
        const numText = String(rank).padStart(pad, '0')
        this.innerHTML = `<span class="tc-rank-cell tc-rank-cell--${tier}"><span class="tc-rank-cell-number">${numText}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RankCell
    }
}

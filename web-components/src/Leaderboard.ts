const TAG_NAME = 'tc-leaderboard'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .map(w => w[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('')
}

type TierClass = 'gold' | 'silver' | 'bronze' | 'default'

function rankTier(rank: number): TierClass {
    if (rank === 1) return 'gold'
    if (rank === 2) return 'silver'
    if (rank === 3) return 'bronze'
    return 'default'
}

export interface LeaderboardTrendInfo {
    value: string
    direction: 'up' | 'down' | 'flat'
}

export interface LeaderboardEntry {
    rank: number
    name: string
    avatarUrl?: string
    tier?: string
    sprints?: number
    trend?: LeaderboardTrendInfo
    points: number
    id?: string
}

export interface LeaderboardColumns {
    rank?: string | false
    dev?: string | false
    tier?: string | false
    sprints?: string | false
    trend?: string | false
    points?: string | false
}

type ColKey = 'rank' | 'dev' | 'tier' | 'sprints' | 'trend' | 'points'

const DEFAULT_LABELS: Record<ColKey, string> = {
    rank: '#',
    dev: 'Developer',
    tier: 'Tier',
    sprints: 'Sprints',
    trend: 'Trend',
    points: 'Points',
}

const COL_KEYS: ColKey[] = ['rank', 'dev', 'tier', 'sprints', 'trend', 'points']

export class Leaderboard extends HTMLElement {
    private _initialised = false
    private _entries: LeaderboardEntry[] = []
    private _columns: LeaderboardColumns = {}

    onSelect: ((entry: LeaderboardEntry) => void) | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get entries(): LeaderboardEntry[] {
        return this._entries
    }
    set entries(v: LeaderboardEntry[]) {
        this._entries = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get columns(): LeaderboardColumns {
        return this._columns
    }
    set columns(v: LeaderboardColumns) {
        this._columns = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this.render()
    }

    private _isVisible(key: ColKey): boolean {
        return (this._columns as Record<string, unknown>)[key] !== false
    }

    private _label(key: ColKey): string {
        const override = (this._columns as Record<string, unknown>)[key]
        return typeof override === 'string' ? esc(override) : DEFAULT_LABELS[key]
    }

    private _fireSelect(entry: LeaderboardEntry): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { id: entry.id, entry },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(entry)
    }

    private render(): void {
        const theadCells = COL_KEYS.filter(k => this._isVisible(k))
            .map(k => `<th scope="col" class="tc-leaderboard-th tc-leaderboard-th-${k}">${this._label(k)}</th>`)
            .join('')

        const rows = this._entries
            .map((entry, idx) => {
                const tier = rankTier(entry.rank)
                const interactive = !!entry.id
                const rowClass = [
                    'tc-leaderboard-row',
                    `tc-leaderboard-row--${tier}`,
                    interactive ? 'tc-leaderboard-row--interactive' : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                const rowAttrs = interactive
                    ? ` tabindex="0" data-idx="${idx}" aria-label="${esc(entry.name)}"`
                    : ` data-idx="${idx}"`

                const avatarHtml = entry.avatarUrl
                    ? `<img src="${esc(entry.avatarUrl)}" alt="${esc(entry.name)}" class="tc-leaderboard-avatar">`
                    : `<span class="tc-leaderboard-avatar tc-leaderboard-avatar--initials" aria-hidden="true">${esc(initials(entry.name))}</span>`

                const cells: string[] = []

                if (this._isVisible('rank')) {
                    const rankNum = String(entry.rank).padStart(2, '0')
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-rank">` +
                            `<span class="tc-leaderboard-rank tc-leaderboard-rank--${tier}">${rankNum}</span>` +
                            `</td>`,
                    )
                }
                if (this._isVisible('dev')) {
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-dev">` +
                            `<span class="tc-leaderboard-dev">` +
                            avatarHtml +
                            `<span class="tc-leaderboard-name">${esc(entry.name)}</span>` +
                            `</span>` +
                            `</td>`,
                    )
                }
                if (this._isVisible('tier')) {
                    const tierHtml = entry.tier
                        ? `<span class="tc-leaderboard-tier">${esc(entry.tier)}</span>`
                        : ''
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-tier">${tierHtml}</td>`,
                    )
                }
                if (this._isVisible('sprints')) {
                    const sprHtml = entry.sprints != null ? esc(String(entry.sprints)) : ''
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-sprints">${sprHtml}</td>`,
                    )
                }
                if (this._isVisible('trend')) {
                    const trendHtml = entry.trend
                        ? `<tc-leaderboard-trend value="${esc(entry.trend.value)}" direction="${esc(entry.trend.direction)}"></tc-leaderboard-trend>`
                        : ''
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-trend">${trendHtml}</td>`,
                    )
                }
                if (this._isVisible('points')) {
                    cells.push(
                        `<td class="tc-leaderboard-td tc-leaderboard-td-points">` +
                            `<span class="tc-leaderboard-points">${esc(String(entry.points))}</span>` +
                            `</td>`,
                    )
                }

                return `<tr class="${rowClass}"${rowAttrs}>${cells.join('')}</tr>`
            })
            .join('')

        this.classList.add('tc-leaderboard-host')
        this.innerHTML =
            `<table class="table tc-leaderboard">` +
            `<thead><tr class="tc-leaderboard-thead-row">${theadCells}</tr></thead>` +
            `<tbody class="tc-leaderboard-body">${rows}</tbody>` +
            `</table>`

        const tbody = this.querySelector<HTMLElement>('.tc-leaderboard-body')
        if (tbody) {
            tbody.addEventListener('click', (e: Event) => {
                const row = (e.target as HTMLElement).closest<HTMLElement>('tr[data-idx]')
                if (!row || !row.classList.contains('tc-leaderboard-row--interactive')) return
                const idx = parseInt(row.dataset.idx ?? '-1', 10)
                const entry = this._entries[idx]
                if (entry?.id) this._fireSelect(entry)
            })
            tbody.addEventListener('keydown', (e: Event) => {
                const ke = e as KeyboardEvent
                if (ke.key !== 'Enter' && ke.key !== ' ') return
                ke.preventDefault()
                const row = (e.target as HTMLElement).closest<HTMLElement>('tr[data-idx]')
                if (!row || !row.classList.contains('tc-leaderboard-row--interactive')) return
                const idx = parseInt(row.dataset.idx ?? '-1', 10)
                const entry = this._entries[idx]
                if (entry?.id) this._fireSelect(entry)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Leaderboard
    }
}

import { bindOnce, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-github-stars-card'

export interface GithubStatsData {
    stars?: number
    forks?: number
    contributors?: number
    version?: string
}

// Pre-compute unconditionally rendered icons at module load time.
const githubIconHtml = lucideByName('github', 'tc-github-stars-card-gh-icon')
const starIconHtml = lucideByName('star', 'tc-github-stars-card-stat-icon')
const forkIconHtml = lucideByName('git-fork', 'tc-github-stars-card-stat-icon')
const usersIconHtml = lucideByName('users', 'tc-github-stars-card-stat-icon')
const tagIconHtml = lucideByName('tag', 'tc-github-stars-card-stat-icon')

function humanise(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
}

export class GithubStarsCard extends HTMLElement {
    private _initialised = false
    private _stats: GithubStatsData = {}
    private _pendingFetch: AbortController | null = null
    private _liveStats: GithubStatsData | null = null
    private _fetchError = false

    onStats: ((stats: GithubStatsData) => void) | null = null

    static get observedAttributes(): string[] {
        return ['owner', 'repo', 'fetch-live', 'cta-label']
    }

    get owner(): string {
        return this.getAttribute('owner') ?? ''
    }
    set owner(v: string) {
        setAttr(this, 'owner', v)
    }

    get repo(): string {
        return this.getAttribute('repo') ?? ''
    }
    set repo(v: string) {
        setAttr(this, 'repo', v)
    }

    get fetchLive(): boolean {
        return this.hasAttribute('fetch-live')
    }
    set fetchLive(v: boolean) {
        if (v) this.setAttribute('fetch-live', '')
        else this.removeAttribute('fetch-live')
    }

    get ctaLabel(): string {
        return this.getAttribute('cta-label') ?? 'View on GitHub'
    }
    set ctaLabel(v: string) {
        setAttr(this, 'cta-label', v)
    }

    get stats(): GithubStatsData {
        return this._stats
    }
    set stats(v: GithubStatsData) {
        this._stats = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this.render()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        if (this.fetchLive) this._startFetch()
    }

    disconnectedCallback(): void {
        this._abortFetch()
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'owner' || name === 'repo') {
            this._liveStats = null
            this._fetchError = false
            this.render()
            if (this.fetchLive) this._startFetch()
        } else if (name === 'fetch-live') {
            if (this.fetchLive) {
                this._liveStats = null
                this._fetchError = false
                this.render()
                this._startFetch()
            } else {
                this._abortFetch()
                this._liveStats = null
                this._fetchError = false
                this.render()
            }
        } else {
            this.render()
        }
    }

    private _abortFetch(): void {
        if (this._pendingFetch) {
            this._pendingFetch.abort()
            this._pendingFetch = null
        }
    }

    private _startFetch(): void {
        this._abortFetch()
        const owner = this.owner
        const repo = this.repo
        if (!owner || !repo) return

        const ctrl = new AbortController()
        this._pendingFetch = ctrl

        fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            {
                signal: ctrl.signal,
            },
        )
            .then((r) => {
                if (!r.ok) throw new Error(`GitHub API responded ${r.status}`)
                return r.json()
            })
            .then((data: Record<string, unknown>) => {
                if (ctrl.signal.aborted) return
                this._liveStats = {
                    stars:
                        typeof data.stargazers_count === 'number'
                            ? data.stargazers_count
                            : undefined,
                    forks: typeof data.forks_count === 'number' ? data.forks_count : undefined,
                }
                this._fetchError = false
                this._pendingFetch = null
                this.render()
                const resolved = this._mergedStats()
                this.dispatchEvent(
                    new CustomEvent('tc-stats', {
                        bubbles: true,
                        composed: true,
                        detail: { stats: resolved },
                    }),
                )
                if (typeof this.onStats === 'function') this.onStats(resolved)
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return
                const isAbort = err instanceof Error && err.name === 'AbortError'
                if (!isAbort) {
                    this._fetchError = true
                    this._pendingFetch = null
                    this.render()
                }
            })
    }

    private _mergedStats(): GithubStatsData {
        return { ...this._liveStats, ...this._stats }
    }

    private _hasPreloadedStats(): boolean {
        return (
            this._stats.stars !== undefined ||
            this._stats.forks !== undefined ||
            this._stats.contributors !== undefined ||
            this._stats.version !== undefined
        )
    }

    private render(): void {
        const owner = this.owner
        const repo = this.repo
        const ctaLabel = this.ctaLabel
        // Show skeleton only when fetch is pending AND there are no pre-loaded stats to show.
        const loading =
            this.fetchLive &&
            !this._liveStats &&
            !this._fetchError &&
            !!owner &&
            !!repo &&
            !this._hasPreloadedStats()
        const repoUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
        const merged = this._mergedStats()

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const slugLabel = owner && repo ? `${esc(owner)}/${esc(repo)}` : ''
            patchHtml(
                this,
                [
                    '<div class="tc-github-stars-card" aria-hidden="true">',
                    '<div class="tc-github-stars-card-head">',
                    githubIconHtml,
                    slugLabel
                        ? `<span class="tc-github-stars-card-slug">${slugLabel}</span>`
                        : '<span class="tc-github-stars-card-slug tc-github-stars-card-skeleton tc-github-stars-card-skeleton--slug"></span>',
                    '</div>',
                    '<div class="tc-github-stars-card-stats">',
                    '<div class="tc-github-stars-card-stat tc-github-stars-card-skeleton tc-github-stars-card-skeleton--stat"></div>',
                    '<div class="tc-github-stars-card-stat tc-github-stars-card-skeleton tc-github-stars-card-skeleton--stat"></div>',
                    '</div>',
                    '</div>',
                    '<span class="visually-hidden">Loading GitHub stats…</span>',
                ].join(''),
            )
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const slugHtml =
            owner && repo
                ? `<a class="tc-github-stars-card-slug" href="${esc(repoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(owner)}/${esc(repo)} on GitHub">${esc(owner)}/${esc(repo)}</a>`
                : `<span class="tc-github-stars-card-slug">${esc(owner || '–')}/${esc(repo || '–')}</span>`

        const statCells: string[] = []

        if (merged.stars !== undefined) {
            statCells.push(
                [
                    '<div class="tc-github-stars-card-stat">',
                    `<span class="tc-github-stars-card-stat-icon" aria-label="Stars">${starIconHtml}</span>`,
                    `<span class="tc-github-stars-card-stat-value">${esc(humanise(merged.stars))}</span>`,
                    '<span class="tc-github-stars-card-stat-label">stars</span>',
                    '</div>',
                ].join(''),
            )
        }

        if (merged.forks !== undefined) {
            statCells.push(
                [
                    '<div class="tc-github-stars-card-stat">',
                    `<span class="tc-github-stars-card-stat-icon" aria-label="Forks">${forkIconHtml}</span>`,
                    `<span class="tc-github-stars-card-stat-value">${esc(humanise(merged.forks))}</span>`,
                    '<span class="tc-github-stars-card-stat-label">forks</span>',
                    '</div>',
                ].join(''),
            )
        }

        if (merged.contributors !== undefined) {
            statCells.push(
                [
                    '<div class="tc-github-stars-card-stat">',
                    `<span class="tc-github-stars-card-stat-icon" aria-label="Contributors">${usersIconHtml}</span>`,
                    `<span class="tc-github-stars-card-stat-value">${esc(humanise(merged.contributors))}</span>`,
                    '<span class="tc-github-stars-card-stat-label">contributors</span>',
                    '</div>',
                ].join(''),
            )
        }

        if (merged.version) {
            statCells.push(
                [
                    '<div class="tc-github-stars-card-stat">',
                    `<span class="tc-github-stars-card-stat-icon" aria-label="Version">${tagIconHtml}</span>`,
                    `<span class="tc-github-stars-card-stat-value tc-github-stars-card-version">${esc(merged.version)}</span>`,
                    '<span class="tc-github-stars-card-stat-label">latest</span>',
                    '</div>',
                ].join(''),
            )
        }

        const errorHtml = this._fetchError
            ? '<div class="tc-github-stars-card-error" role="alert">Could not load live stats.</div>'
            : ''

        const ctaUrl = owner && repo ? `${repoUrl}` : '#'
        const ctaHtml = [
            `<a class="tc-github-stars-card-cta" href="${esc(ctaUrl)}" target="_blank" rel="noopener noreferrer"`,
            ` aria-label="${esc(ctaLabel)} — ${esc(owner)}/${esc(repo)}"`,
            '>',
            `${esc(ctaLabel)}`,
            '</a>',
        ].join('')

        patchHtml(
            this,
            [
                '<div class="tc-github-stars-card">',
                '<div class="tc-github-stars-card-head">',
                githubIconHtml,
                slugHtml,
                '</div>',
                statCells.length
                    ? `<div class="tc-github-stars-card-stats">${statCells.join('')}</div>`
                    : '',
                errorHtml,
                '<div class="tc-github-stars-card-footer">',
                ctaHtml,
                '</div>',
                '</div>',
            ].join(''),
        )

        const ctaEl = this.querySelector<HTMLAnchorElement>('.tc-github-stars-card-cta')
        if (ctaEl) {
            bindOnce(ctaEl, 'click', () => {
                this.dispatchEvent(
                    new CustomEvent('tc-cta-click', {
                        bubbles: true,
                        composed: true,
                        detail: { owner, repo },
                    }),
                )
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GithubStarsCard
    }
}

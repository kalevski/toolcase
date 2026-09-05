import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-changelog'

export interface ChangelogEntry {
    date: string
    title: string
    description: string
    tags?: string[]
}

export class Changelog extends HTMLElement {
    private _initialised = false
    private _entries: ChangelogEntry[] = []

    static get observedAttributes(): string[] {
        return ['max-visible', 'read-more-href', 'read-more-label', 'loading']
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

    get entries(): ChangelogEntry[] {
        return this._entries
    }
    set entries(v: ChangelogEntry[]) {
        this._entries = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get maxVisible(): number | null {
        const raw = this.getAttribute('max-visible')
        if (raw === null) return null
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 1 ? null : n
    }
    set maxVisible(v: number | null) {
        if (v != null) this.setAttribute('max-visible', String(v))
        else this.removeAttribute('max-visible')
    }

    get readMoreHref(): string {
        return this.getAttribute('read-more-href') ?? ''
    }
    set readMoreHref(v: string) {
        setAttr(this, 'read-more-href', v)
    }

    get readMoreLabel(): string {
        return this.getAttribute('read-more-label') ?? 'Read more'
    }
    set readMoreLabel(v: string) {
        setAttr(this, 'read-more-label', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private _renderEntry(entry: ChangelogEntry): string {
        const tagsHtml =
            entry.tags && entry.tags.length > 0
                ? `<div class="tc-changelog-tags">${entry.tags.map((t) => `<span class="tc-changelog-tag">${esc(t)}</span>`).join('')}</div>`
                : ''
        return (
            `<li class="tc-changelog-item">` +
            `<div class="tc-changelog-node" aria-hidden="true"><span class="tc-changelog-dot"></span></div>` +
            `<article class="tc-changelog-card">` +
            `<time class="tc-changelog-date">${esc(entry.date)}</time>` +
            `<h4 class="tc-changelog-title">${esc(entry.title)}</h4>` +
            `<p class="tc-changelog-desc">${esc(entry.description)}</p>` +
            tagsHtml +
            `</article>` +
            `</li>`
        )
    }

    private render(): void {
        const loading = this.loading

        if (loading) {
            const skeletonRow = () =>
                `<li class="tc-changelog-item tc-changelog-item--skeleton" aria-hidden="true">` +
                `<div class="tc-changelog-node" aria-hidden="true"><span class="tc-changelog-dot tc-changelog-dot--skeleton"></span></div>` +
                `<article class="tc-changelog-card tc-changelog-card--skeleton">` +
                `<div class="tc-changelog-skeleton tc-changelog-skeleton--date"></div>` +
                `<div class="tc-changelog-skeleton tc-changelog-skeleton--title"></div>` +
                `<div class="tc-changelog-skeleton tc-changelog-skeleton--desc"></div>` +
                `</article>` +
                `</li>`

            patchHtml(
                this,
                `<div class="tc-changelog" aria-busy="true">` +
                    `<ol class="tc-changelog-list">` +
                    `<li class="visually-hidden" role="status">Loading changelog…</li>` +
                    skeletonRow() +
                    skeletonRow() +
                    skeletonRow() +
                    `</ol>` +
                    `</div>`,
            )
            return
        }

        const maxVisible = this.maxVisible
        const all = this._entries
        const visible = maxVisible !== null ? all.slice(0, maxVisible) : all
        const hasMore = maxVisible !== null && all.length > maxVisible
        const href = this.readMoreHref
        const label = this.readMoreLabel

        const itemsHtml = visible.map((e) => this._renderEntry(e)).join('')
        const moreHtml =
            hasMore && href
                ? `<a class="tc-changelog-more" href="${esc(href)}">${esc(label)}</a>`
                : ''

        patchHtml(
            this,
            `<div class="tc-changelog">` +
                `<ol class="tc-changelog-list">` +
                itemsHtml +
                `</ol>` +
                moreHtml +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Changelog
    }
}

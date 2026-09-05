import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-codex'

export interface CodexEntry {
    id: string
    name: string
    icon?: string
    discovered?: boolean
    description?: string
    stats?: { label: string; value: string | number }[]
}

export interface CodexEventMap {
    'tc-select': CustomEvent<{ id: string }>
}

// Discovered rows fall back to a lucide diamond (the gc-codex `◆` glyph); the
// design system forbids unicode-as-icon, so the source's `?` placeholder for
// undiscovered entries becomes a lucide circle-help glyph instead.
const DEFAULT_ICON = 'diamond'
const lockedIconHtml = lucideByName('circle-help')

export class Codex extends HTMLElement {
    private _initialised = false
    private _entries: CodexEntry[] = []

    /** Optional callback fired alongside the `tc-select` CustomEvent. */
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get entries(): CodexEntry[] {
        return this._entries.slice()
    }
    set entries(value: CodexEntry[]) {
        this._entries = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private emit(id: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', { detail: { id }, bubbles: true, composed: true }),
        )
    }

    private formatValue(v: string | number): string {
        return typeof v === 'number' ? v.toLocaleString() : v
    }

    private _rowFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const row = target.closest<HTMLElement>('.tc-codex-row')
        if (!row || !this.contains(row)) return null
        return row
    }

    private _select(id: string): void {
        this.selectedId = id
        this.emit(id)
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _onClick = (e: MouseEvent): void => {
        const row = this._rowFor(e.target)
        if (!row) return
        const id = row.dataset.id
        if (id != null) this._select(id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const row = this._rowFor(e.target)
        if (!row) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const id = row.dataset.id
            if (id != null) this._select(id)
        }
    }

    private _detailMarkup(entry: CodexEntry): string {
        if (!entry.discovered) {
            return (
                `<span class="tc-codex-detail-eyebrow">Codex</span>` +
                `<h3 class="tc-codex-detail-name">???</h3>` +
                `<p class="tc-codex-detail-description">Undiscovered.</p>`
            )
        }
        const description = entry.description
            ? `<p class="tc-codex-detail-description">${esc(entry.description)}</p>`
            : ''
        const stats = (entry.stats || [])
            .map(
                (stat) =>
                    `<div class="tc-codex-detail-stat">` +
                    `<span class="tc-codex-detail-stat-label">${esc(stat.label)}</span>` +
                    `<span class="tc-codex-detail-stat-value">${esc(this.formatValue(stat.value))}</span>` +
                    `</div>`,
            )
            .join('')
        const statsBlock = stats ? `<div class="tc-codex-detail-stats">${stats}</div>` : ''
        return (
            `<span class="tc-codex-detail-eyebrow">Codex</span>` +
            `<h3 class="tc-codex-detail-name">${esc(entry.name)}</h3>` +
            description +
            statsBlock
        )
    }

    private render(): void {
        this.classList.add('tc-codex')

        const selected = this.selectedId
        const active = this._entries.find((e) => e.id === selected) ?? null

        // Preserve keyboard focus across the full re-render: snapshot the focused
        // row's id, then refocus the matching row once the new markup is in place.
        const focusedId = this.querySelector<HTMLElement>('.tc-codex-row:focus')?.dataset.id ?? null

        const rowsMarkup = this._entries
            .map((entry) => {
                const isSelected = entry.id === selected
                const discovered = !!entry.discovered
                const classes = ['tc-codex-row']
                if (isSelected) classes.push('is-selected')
                if (!discovered) classes.push('is-undiscovered')
                const glyph = discovered
                    ? lucideByName(entry.icon || DEFAULT_ICON) || lucideByName(DEFAULT_ICON)
                    : lockedIconHtml
                const name = discovered ? esc(entry.name) : '???'
                return (
                    `<div role="listitem" class="${classes.join(' ')}"` +
                    ` data-id="${esc(entry.id)}"` +
                    ` tabindex="0"` +
                    ` aria-current="${isSelected ? 'true' : 'false'}">` +
                    `<span class="tc-codex-row-glyph" aria-hidden="true">${glyph}</span>` +
                    `<span class="tc-codex-row-name">${name}</span>` +
                    `</div>`
                )
            })
            .join('')

        const detailMarkup = active
            ? this._detailMarkup(active)
            : `<p class="tc-codex-detail-empty">Select an entry.</p>`

        patchHtml(
            this,
            `<div class="tc-codex-list" role="list">${rowsMarkup}</div>` +
                `<div class="tc-codex-detail">${detailMarkup}</div>`,
        )

        if (focusedId != null) {
            this.querySelector<HTMLElement>(
                `.tc-codex-row[data-id="${CSS.escape(focusedId)}"]`,
            )?.focus()
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Codex
    }
}

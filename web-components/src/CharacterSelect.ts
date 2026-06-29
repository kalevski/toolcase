import { isImageSrc } from './internal/image'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-character-select'

export interface CharacterEntry {
    id: string
    name: string
    role?: string
    locked?: boolean
    portrait?: string
    description?: string
    stats?: { label: string; value: string | number }[]
}

export interface CharacterSelectEventMap {
    'tc-select': CustomEvent<{ id: string }>
    'tc-confirm': CustomEvent<{ id: string }>
}

// Locked tiles carry a lucide lock glyph instead of the game-components 🔒 emoji
// (the design system forbids emoji-as-icon). Pre-computed once at module load.
const lockIconHtml = lucideByName('lock')

// A portrait that looks like an image source is rendered as an <img>; otherwise
// the string is treated as a short glyph/initials label inside the tile.

export class CharacterSelect extends HTMLElement {
    private _initialised = false
    private _characters: CharacterEntry[] = []

    /** Optional callbacks fired alongside the matching CustomEvents. */
    onSelect: ((id: string) => void) | null = null
    onConfirm: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.setAttribute('role', 'listbox')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback
        // removes them, and a move/remount (React reconciliation) disconnects
        // then reconnects without re-running the one-time init above. Adding the
        // same handler reference twice is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('dblclick', this._onDblClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('dblclick', this._onDblClick)
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

    get characters(): CharacterEntry[] {
        return this._characters.slice()
    }
    set characters(v: CharacterEntry[]) {
        this._characters = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private emit(name: string, id: string): void {
        this.dispatchEvent(new CustomEvent(name, { detail: { id }, bubbles: true, composed: true }))
    }

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private _tileFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const tile = target.closest<HTMLElement>('.tc-character-select-tile')
        if (!tile || !this.contains(tile)) return null
        // Locked tiles are inert.
        if (tile.getAttribute('aria-disabled') === 'true') return null
        return tile
    }

    private _select(id: string): void {
        this.selectedId = id
        this.emit('tc-select', id)
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _confirm(id: string): void {
        this.selectedId = id
        this.emit('tc-confirm', id)
        if (typeof this.onConfirm === 'function') this.onConfirm(id)
    }

    private _onClick = (e: MouseEvent): void => {
        const tile = this._tileFor(e.target)
        if (!tile) return
        const id = tile.dataset.id
        if (id != null) this._select(id)
    }

    private _onDblClick = (e: MouseEvent): void => {
        const tile = this._tileFor(e.target)
        if (!tile) return
        const id = tile.dataset.id
        if (id != null) this._confirm(id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const tile = this._tileFor(e.target)
        if (!tile) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const id = tile.dataset.id
            if (id != null) this._select(id)
        }
    }

    private _portraitMarkup(character: CharacterEntry): string {
        const portrait = character.portrait
        if (portrait && isImageSrc(portrait)) {
            return (
                `<span class="tc-character-select-portrait">` +
                `<img src="${esc(portrait)}" alt="" />` +
                `</span>`
            )
        }
        const glyph = portrait || character.name.charAt(0).toUpperCase()
        return `<span class="tc-character-select-portrait" aria-hidden="true">${esc(glyph)}</span>`
    }

    private _detailMarkup(character: CharacterEntry): string {
        const role = character.role
            ? `<span class="tc-character-select-detail-role">${esc(character.role)}</span>`
            : ''
        const description = character.description
            ? `<p class="tc-character-select-detail-description">${esc(character.description)}</p>`
            : ''
        const stats = (character.stats || [])
            .map(
                (stat) =>
                    `<div class="tc-character-select-detail-stat">` +
                    `<span class="tc-character-select-detail-stat-label">${esc(stat.label)}</span>` +
                    `<span class="tc-character-select-detail-stat-value">${esc(this.formatValue(stat.value))}</span>` +
                    `</div>`,
            )
            .join('')
        const statsBlock = stats
            ? `<div class="tc-character-select-detail-stats">${stats}</div>`
            : ''
        return (
            `${role}` +
            `<h3 class="tc-character-select-detail-name">${esc(character.name)}</h3>` +
            description +
            statsBlock
        )
    }

    private render(): void {
        this.classList.add('tc-character-select')

        const selected = this.selectedId
        const active = this._characters.find((c) => c.id === selected) ?? null

        const tilesMarkup = this._characters
            .map((character) => {
                const isSelected = character.id === selected
                const locked = !!character.locked
                const classes = ['tc-character-select-tile']
                if (isSelected) classes.push('is-selected')
                if (locked) classes.push('is-locked')
                const roleMarkup = character.role
                    ? `<span class="tc-character-select-tile-role">${esc(character.role)}</span>`
                    : ''
                const lockMarkup = locked
                    ? `<span class="tc-character-select-lock" aria-hidden="true">${lockIconHtml}</span>`
                    : ''
                return (
                    `<div role="option" class="${classes.join(' ')}"` +
                    ` data-id="${esc(character.id)}"` +
                    ` tabindex="${locked ? '-1' : '0'}"` +
                    ` aria-selected="${isSelected ? 'true' : 'false'}"` +
                    ` aria-disabled="${locked ? 'true' : 'false'}">` +
                    this._portraitMarkup(character) +
                    `<span class="tc-character-select-tile-body">` +
                    `<span class="tc-character-select-tile-name">${esc(character.name)}</span>` +
                    roleMarkup +
                    `</span>` +
                    lockMarkup +
                    `</div>`
                )
            })
            .join('')

        const detailMarkup = active
            ? this._detailMarkup(active)
            : `<p class="tc-character-select-detail-empty">Select a character.</p>`

        this.innerHTML =
            `<div class="tc-character-select-grid">${tilesMarkup}</div>` +
            `<div class="tc-character-select-detail">${detailMarkup}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CharacterSelect
    }
}

import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-controls-rebind-list'

export interface ControlBinding {
    id: string
    action: string
    key?: string
}

export interface ControlsRebindListEventMap {
    'tc-rebind': CustomEvent<{ id: string }>
}

export class ControlsRebindList extends HTMLElement {
    private _initialised = false
    private _bindings: ControlBinding[] = []

    /** Optional callback fired alongside the `tc-rebind` CustomEvent. */
    onRebind: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
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

    get bindings(): ControlBinding[] {
        return this._bindings.slice()
    }
    set bindings(value: ControlBinding[]) {
        this._bindings = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private _rowFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const row = target.closest<HTMLElement>('.tc-controls-rebind-list-row')
        if (!row || !this.contains(row)) return null
        return row
    }

    private _rebind(row: HTMLElement): void {
        const id = row.dataset.id ?? ''
        this.dispatchEvent(
            new CustomEvent('tc-rebind', {
                detail: { id },
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this.onRebind === 'function') this.onRebind(id)
    }

    private _onClick = (e: MouseEvent): void => {
        const row = this._rowFor(e.target)
        if (row) this._rebind(row)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const row = this._rowFor(e.target)
        if (!row) return
        e.preventDefault()
        this._rebind(row)
    }

    private render(): void {
        const rowsHTML = this._bindings
            .map((binding) => {
                const key = binding.key ?? ''
                const keyMarkup = key
                    ? `<kbd class="tc-controls-rebind-list-key">${esc(key)}</kbd>`
                    : `<span class="tc-controls-rebind-list-empty">Unbound</span>`
                return (
                    `<div class="tc-controls-rebind-list-row" role="listitem" data-id="${esc(binding.id)}" tabindex="0">` +
                    `<span class="tc-controls-rebind-list-action">${esc(binding.action)}</span>` +
                    `<div class="tc-controls-rebind-list-control">` +
                    keyMarkup +
                    `<span class="tc-controls-rebind-list-rebind">Rebind</span>` +
                    `</div>` +
                    `</div>`
                )
            })
            .join('')
        patchHtml(this, `<div class="tc-controls-rebind-list">${rowsHTML}</div>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ControlsRebindList
    }
}

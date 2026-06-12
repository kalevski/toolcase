import * as LucideIcons from 'lucide-static'
import { icon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-action-row-list'

export interface ActionRow {
    key: string
    title: string
    description?: string
    label?: string
    icon?: string
    variant?: string
    disabled?: boolean
}

export class ActionRowList extends HTMLElement {
    private _initialised = false
    private _actions: ActionRow[] = []

    onActionClick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['outline', 'trailing-icon']
    }

    constructor() {
        super()
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

    get outline(): boolean {
        return this.hasAttribute('outline')
    }
    set outline(v: boolean) {
        if (v) this.setAttribute('outline', '')
        else this.removeAttribute('outline')
    }

    get trailingIcon(): string | null {
        return this.getAttribute('trailing-icon')
    }
    set trailingIcon(v: string | null) {
        if (v != null) this.setAttribute('trailing-icon', v)
        else this.removeAttribute('trailing-icon')
    }

    get actions(): ActionRow[] {
        return this._actions
    }
    set actions(v: ActionRow[]) {
        this._actions = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _resolveIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr, 'tc-action-row-icon')
    }

    private _trailingIconHtml(): string {
        const attr = this.getAttribute('trailing-icon')
        // null = attribute absent → show default chevron-right
        if (attr === null) {
            return `<span class="tc-action-row-trailing-icon" aria-hidden="true">${chevronRightIcon}</span>`
        }
        // empty string or "none" → suppress
        if (attr === '' || attr === 'none') return ''
        // named lucide icon
        const svgStr = (LucideIcons as Record<string, string>)[attr]
        if (svgStr) {
            return `<span class="tc-action-row-trailing-icon" aria-hidden="true">${icon(svgStr)}</span>`
        }
        // unknown name → fallback to default chevron-right
        return `<span class="tc-action-row-trailing-icon" aria-hidden="true">${chevronRightIcon}</span>`
    }

    private render(): void {
        const outline = this.outline
        const trailingIconHtml = this._trailingIconHtml()

        const rows = this._actions.map((action, idx) => {
            const variant = action.variant ?? 'secondary'
            const btnClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
            const disabled = action.disabled === true
            const disabledAttr = disabled ? ' disabled' : ''
            const disabledRow = disabled ? ' data-disabled="true"' : ''
            const iconHtml = action.icon ? this._resolveIcon(action.icon) : ''
            const labelHtml = action.label != null
                ? `<span class="tc-action-row-cta-label">${action.label}</span>`
                : ''
            const descHtml = action.description != null
                ? `<span class="tc-action-row-desc">${action.description}</span>`
                : ''

            return (
                `<div class="tc-action-row list-group-item d-flex align-items-center justify-content-between" data-idx="${idx}"${disabledRow}>` +
                    `<div class="tc-action-row-info">` +
                        `<span class="tc-action-row-title">${action.title}</span>` +
                        descHtml +
                    `</div>` +
                    `<button class="btn btn-sm ${btnClass} tc-action-row-cta" type="button" data-idx="${idx}"${disabledAttr} aria-label="${action.label ?? action.title}">` +
                        iconHtml + labelHtml + trailingIconHtml +
                    `</button>` +
                `</div>`
            )
        }).join('')

        this.innerHTML = `<div class="tc-action-row-list list-group">${rows}</div>`

        // Single delegated click listener on the list container.
        const list = this.querySelector<HTMLElement>('.tc-action-row-list')
        if (list) {
            list.addEventListener('click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tc-action-row-cta')
                if (!btn || btn.disabled) return
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._actions.length) {
                    const key = this._actions[idx].key
                    this.dispatchEvent(new CustomEvent('tc-action-click', { bubbles: true, detail: { key } }))
                    if (typeof this.onActionClick === 'function') this.onActionClick(key)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ActionRowList
    }
}

import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-linked-providers-card'

export interface LinkedProvider {
    key: string
    label: string
    connected?: boolean
    account?: string
    icon?: string
}

const DEFAULT_TITLE = 'Linked providers'
const DEFAULT_EMPTY_LABEL = 'No providers linked.'
const FALLBACK_ICON = 'Link'

export class LinkedProvidersCard extends HTMLElement {
    private _initialised = false
    private _providers: LinkedProvider[] = []
    private _brandColors: Record<string, string> = {}
    private _iconForProvider: ((key: string) => string) | null = null

    onToggle: ((key: string, connected: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['title', 'empty-label']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._handleClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? DEFAULT_TITLE
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get emptyLabel(): string {
        return this.getAttribute('empty-label') ?? DEFAULT_EMPTY_LABEL
    }
    set emptyLabel(v: string) {
        this.setAttribute('empty-label', v)
    }

    get providers(): LinkedProvider[] {
        return this._providers
    }
    set providers(v: LinkedProvider[]) {
        this._providers = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get brandColors(): Record<string, string> {
        return this._brandColors
    }
    set brandColors(v: Record<string, string>) {
        this._brandColors = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this.render()
    }

    get iconForProvider(): ((key: string) => string) | null {
        return this._iconForProvider
    }
    set iconForProvider(v: ((key: string) => string) | null) {
        this._iconForProvider = typeof v === 'function' ? v : null
        if (this._initialised) this.render()
    }

    private _resolveProviderIcon(p: LinkedProvider): string {
        let iconName: string | undefined
        if (this._iconForProvider) {
            try {
                iconName = this._iconForProvider(p.key)
            } catch {
                /* skip */
            }
        }
        if (!iconName) iconName = p.icon
        if (!iconName) iconName = FALLBACK_ICON
        const svgStr =
            (LucideIcons as Record<string, string>)[iconName] ??
            (LucideIcons as Record<string, string>)[FALLBACK_ICON] ??
            ''
        return svgStr ? icon(svgStr, 'tc-linked-providers-card__icon-svg') : ''
    }

    private _resolveActionIcon(connected: boolean): string {
        const candidates = connected ? ['Unlink', 'LinkOff', 'Link'] : ['Link', 'LinkIcon']
        for (const name of candidates) {
            const svgStr = (LucideIcons as Record<string, string>)[name]
            if (svgStr) return icon(svgStr, 'tc-linked-providers-card__action-icon')
        }
        return ''
    }

    private _handleClick = (e: Event): void => {
        const btn = (e.target as Element).closest('.tc-linked-providers-card__btn')
        if (!btn) return
        const key = (btn as HTMLElement).dataset.key ?? ''
        const connected = (btn as HTMLElement).dataset.connected === 'true'
        this.dispatchEvent(
            new CustomEvent('tc-toggle', {
                bubbles: true,
                composed: true,
                detail: { key, connected },
            }),
        )
        if (typeof this.onToggle === 'function') this.onToggle(key, connected)
    }

    private render(): void {
        const titleVal = this.title
        const emptyLabel = this.emptyLabel
        const providers = this._providers

        const headerHtml =
            `<div class="card-header tc-linked-providers-card__header">` +
            `<h3 class="tc-linked-providers-card__title">${esc(titleVal)}</h3>` +
            `</div>`

        let contentHtml: string
        if (providers.length === 0) {
            contentHtml = `<div class="tc-linked-providers-card__empty" role="status">${esc(emptyLabel)}</div>`
        } else {
            const rows = providers
                .map((p) => {
                    const iconHtml = this._resolveProviderIcon(p)
                    const brandColor = this._brandColors[p.key]
                    const tileStyle = brandColor ? ` style="color: ${esc(brandColor)}"` : ''
                    const accountHtml = p.account
                        ? `<span class="tc-linked-providers-card__account">${esc(p.account)}</span>`
                        : ''
                    const connectedDot = p.connected
                        ? `<span class="tc-linked-providers-card__connected-dot" aria-hidden="true"></span>`
                        : ''
                    const actionIconHtml = this._resolveActionIcon(p.connected ?? false)
                    const actionLabel = p.connected ? `Disconnect ${p.label}` : `Connect ${p.label}`
                    return (
                        `<li class="tc-linked-providers-card__row" role="listitem">` +
                        `<span class="tc-linked-providers-card__tile"${tileStyle} aria-hidden="true">${iconHtml}</span>` +
                        `<span class="tc-linked-providers-card__info">` +
                        `<span class="tc-linked-providers-card__label">${esc(p.label)}</span>` +
                        accountHtml +
                        `</span>` +
                        connectedDot +
                        `<button class="tc-linked-providers-card__btn" type="button" ` +
                        `aria-label="${esc(actionLabel)}" ` +
                        `data-key="${esc(p.key)}" data-connected="${p.connected ? 'true' : 'false'}">${actionIconHtml}</button>` +
                        `</li>`
                    )
                })
                .join('')
            contentHtml = `<ul class="tc-linked-providers-card__list" role="list">${rows}</ul>`
        }

        this.innerHTML = `<div class="card tc-linked-providers-card">${headerHtml}${contentHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LinkedProvidersCard
    }
}

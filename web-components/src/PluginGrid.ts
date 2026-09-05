import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-plugin-grid'

const COLUMNS = [2, 3, 4] as const
export type PluginGridColumns = 2 | 3 | 4

function formatDownloads(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
}

const downloadIconHtml = lucideByName('download')
const copyIconHtml = lucideByName('copy')

export interface PluginItem {
    name: string
    description?: string
    logo?: string
    iconName?: string
    install?: string
    downloads?: number
}

export class PluginGrid extends HTMLElement {
    private _initialised = false
    private _items: PluginItem[] = []

    static get observedAttributes(): string[] {
        return ['columns', 'title-text']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Re-attach host listeners on every connect — disconnectedCallback removes
        // them, and a remount (React reconciliation) disconnects then reconnects
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

    get columns(): PluginGridColumns {
        const v = parseInt(this.getAttribute('columns') ?? '3', 10)
        return (COLUMNS as readonly number[]).includes(v) ? (v as PluginGridColumns) : 3
    }
    set columns(v: PluginGridColumns) {
        this.setAttribute('columns', String(v))
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? ''
    }
    set titleText(v: string) {
        if (v) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get items(): PluginItem[] {
        return this._items
    }
    set items(v: PluginItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _handleClick = (e: Event): void => {
        const btn = (e.target as Element).closest('[data-install]')
        if (!btn) return
        const install = (btn as HTMLElement).dataset.install ?? ''
        this.dispatchEvent(
            new CustomEvent('tc-copy', {
                bubbles: true,
                composed: true,
                detail: { install },
            }),
        )
    }

    private _renderCard(item: PluginItem): string {
        // Logo area — image URL takes priority, then lucide icon by iconName
        let logoHtml = ''
        if (item.logo) {
            logoHtml = `<div class="tc-plugin-card-logo"><img src="${esc(item.logo)}" alt="${esc(item.name)} logo" loading="lazy"></div>`
        } else if (item.iconName) {
            const iconSvg = lucideByName(item.iconName)
            if (iconSvg) {
                logoHtml = `<div class="tc-plugin-card-logo" aria-hidden="true">${iconSvg}</div>`
            }
        }

        const nameHtml = `<h3 class="tc-plugin-card-name">${esc(item.name)}</h3>`

        const descHtml = item.description
            ? `<p class="tc-plugin-card-desc">${esc(item.description)}</p>`
            : ''

        const installHtml = item.install
            ? `<div class="tc-plugin-card-install-row">` +
              `<code class="tc-plugin-card-install">${esc(item.install)}</code>` +
              `<button class="tc-plugin-card-copy" type="button" aria-label="Copy install command" data-install="${esc(item.install)}">${copyIconHtml}</button>` +
              `</div>`
            : ''

        const downloadsHtml =
            item.downloads !== undefined
                ? `<span class="tc-plugin-card-downloads"><span aria-hidden="true">${downloadIconHtml}</span><span>${esc(formatDownloads(item.downloads))}</span></span>`
                : ''

        const footerContent = installHtml || downloadsHtml
        const footerHtml = footerContent
            ? `<footer class="tc-plugin-card-footer">${installHtml}${downloadsHtml}</footer>`
            : ''

        return [
            '<article class="tc-plugin-card">',
            logoHtml,
            nameHtml,
            descHtml,
            footerHtml,
            '</article>',
        ].join('')
    }

    private render(): void {
        const cols = this.columns
        const title = this.titleText

        const headerHtml = title
            ? `<div class="tc-plugin-grid-header"><h2 class="tc-plugin-grid-title">${esc(title)}</h2></div>`
            : ''

        const cardsHtml = this._items.map((item) => this._renderCard(item)).join('')

        patchHtml(
            this,
            `${headerHtml}<div class="tc-plugin-grid" data-columns="${cols}">${cardsHtml}</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PluginGrid
    }
}

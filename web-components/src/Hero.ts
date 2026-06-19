import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-hero'

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
type HeadingLevel = (typeof HEADING_LEVELS)[number]

export interface HeroAction {
    label: string
    href?: string
    onClick?: () => void
}

export interface HeroStatCard {
    label: string
    value: string
}

export interface HeroMetric {
    label: string
    value: string
}

// Convert kebab-case or lowercase name to PascalCase for lucide-static lookup.

// Fixed scatter positions for background icons (top/right/bottom/left as percentages).
const BG_ICON_POSITIONS: Array<{
    top?: string
    bottom?: string
    left?: string
    right?: string
    rotate: number
}> = [
    { top: '8%', left: '4%', rotate: -15 },
    { top: '15%', right: '6%', rotate: 20 },
    { top: '55%', left: '2%', rotate: 5 },
    { top: '65%', right: '4%', rotate: -10 },
    { top: '38%', left: '12%', rotate: 30 },
    { top: '28%', right: '18%', rotate: -25 },
    { bottom: '12%', left: '28%', rotate: 15 },
]

export class Hero extends HTMLElement {
    private _initialised = false
    private _primaryAction: HeroAction | null = null
    private _secondaryAction: HeroAction | null = null
    private _statCards: HeroStatCard[] = []
    private _metrics: HeroMetric[] = []
    private _bgIcons: string[] = []

    onPrimaryAction: (() => void) | null = null
    onSecondaryAction: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['eyebrow', 'title', 'title-as', 'description', 'background-pattern-src']
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

    get eyebrow(): string | null {
        return this.getAttribute('eyebrow')
    }
    set eyebrow(v: string | null) {
        if (v != null) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    // Note: 'title' getter/setter deliberately omitted — HTMLElement already
    // exposes a native .title property that reflects the 'title' attribute.
    // Read via getAttribute('title') inside render().

    get titleAs(): HeadingLevel {
        const v = this.getAttribute('title-as') as HeadingLevel
        return HEADING_LEVELS.includes(v) ? v : 'h1'
    }
    set titleAs(v: string) {
        this.setAttribute('title-as', v)
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get backgroundPatternSrc(): string | null {
        return this.getAttribute('background-pattern-src')
    }
    set backgroundPatternSrc(v: string | null) {
        if (v != null) this.setAttribute('background-pattern-src', v)
        else this.removeAttribute('background-pattern-src')
    }

    get primaryAction(): HeroAction | null {
        return this._primaryAction
    }
    set primaryAction(v: HeroAction | null) {
        this._primaryAction = v && typeof v === 'object' ? v : null
        if (this._initialised) this.render()
    }

    get secondaryAction(): HeroAction | null {
        return this._secondaryAction
    }
    set secondaryAction(v: HeroAction | null) {
        this._secondaryAction = v && typeof v === 'object' ? v : null
        if (this._initialised) this.render()
    }

    get statCards(): HeroStatCard[] {
        return this._statCards
    }
    set statCards(v: HeroStatCard[]) {
        this._statCards = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get metrics(): HeroMetric[] {
        return this._metrics
    }
    set metrics(v: HeroMetric[]) {
        this._metrics = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get bgIcons(): string[] {
        return this._bgIcons
    }
    set bgIcons(v: string[]) {
        this._bgIcons = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _dispatchAction(which: 'primary' | 'secondary'): void {
        this.dispatchEvent(
            new CustomEvent('tc-action', {
                bubbles: true,
                composed: true,
                detail: { which },
            }),
        )
        if (which === 'primary') {
            if (typeof this.onPrimaryAction === 'function') this.onPrimaryAction()
            if (typeof this._primaryAction?.onClick === 'function') this._primaryAction.onClick()
        } else {
            if (typeof this.onSecondaryAction === 'function') this.onSecondaryAction()
            if (typeof this._secondaryAction?.onClick === 'function')
                this._secondaryAction.onClick()
        }
    }

    private render(): void {
        const eyebrow = this.getAttribute('eyebrow')
        const titleText = this.getAttribute('title') ?? ''
        const titleAs = this.titleAs
        const description = this.getAttribute('description') ?? ''
        const bgPatternSrc = this.getAttribute('background-pattern-src')

        // Background layer
        const patternStyle = bgPatternSrc
            ? ` style="background-image: url('${esc(bgPatternSrc)}');"`
            : ''

        const bgIconsHtml = this._bgIcons
            .slice(0, BG_ICON_POSITIONS.length)
            .map((name, i) => {
                const svg = lucideByName(name)
                if (!svg) return ''
                const pos = BG_ICON_POSITIONS[i]
                const style = [
                    pos.top !== undefined ? `top:${pos.top};` : '',
                    pos.bottom !== undefined ? `bottom:${pos.bottom};` : '',
                    pos.left !== undefined ? `left:${pos.left};` : '',
                    pos.right !== undefined ? `right:${pos.right};` : '',
                    `transform:rotate(${pos.rotate}deg);`,
                ].join('')
                return (
                    `<span class="tc-hero-bg-icon-wrap" aria-hidden="true" style="${style}">` +
                    icon(svg, 'tc-hero-bg-icon') +
                    `</span>`
                )
            })
            .join('')

        const backgroundHtml =
            bgPatternSrc || this._bgIcons.length
                ? `<div class="tc-hero-bg"${patternStyle}>${bgIconsHtml}</div>`
                : ''

        // Eyebrow
        const eyebrowHtml = eyebrow ? `<span class="tc-hero-eyebrow">${esc(eyebrow)}</span>` : ''

        // Title heading
        const titleHtml = `<${titleAs} class="tc-hero-title">${esc(titleText)}</${titleAs}>`

        // Description
        const descriptionHtml = description
            ? `<p class="tc-hero-description">${esc(description)}</p>`
            : ''

        // Primary action
        let primaryHtml = ''
        if (this._primaryAction) {
            const label = esc(this._primaryAction.label)
            if (this._primaryAction.href) {
                primaryHtml = `<a href="${esc(this._primaryAction.href)}" class="btn btn-primary tc-hero-btn-primary" data-which="primary">${label}</a>`
            } else {
                primaryHtml = `<button type="button" class="btn btn-primary tc-hero-btn-primary" data-which="primary">${label}</button>`
            }
        }

        // Secondary action
        let secondaryHtml = ''
        if (this._secondaryAction) {
            const label = esc(this._secondaryAction.label)
            if (this._secondaryAction.href) {
                secondaryHtml = `<a href="${esc(this._secondaryAction.href)}" class="btn btn-outline-primary tc-hero-btn-secondary" data-which="secondary">${label}</a>`
            } else {
                secondaryHtml = `<button type="button" class="btn btn-outline-primary tc-hero-btn-secondary" data-which="secondary">${label}</button>`
            }
        }

        const actionsHtml =
            primaryHtml || secondaryHtml
                ? `<div class="tc-hero-actions">${primaryHtml}${secondaryHtml}</div>`
                : ''

        // Stat cards (centered row, sits inside the main column under the actions)
        const statCardsHtml = this._statCards.length
            ? `<div class="tc-hero-stats">${this._statCards
                  .map(
                      (s) =>
                          `<div class="tc-hero-stat-card">` +
                          `<span class="tc-hero-stat-value">${esc(s.value)}</span>` +
                          `<span class="tc-hero-stat-label">${esc(s.label)}</span>` +
                          `</div>`,
                  )
                  .join('')}</div>`
            : ''

        // Metrics live in a separate centered band below a hairline separator,
        // mirroring the react Hero's __separator + __bottom structure.
        const metricsHtml = this._metrics.length
            ? '<div class="tc-hero-separator" aria-hidden="true"></div>' +
              '<div class="tc-hero-bottom"><div class="tc-hero-bottom-inner">' +
              `<div class="tc-hero-metrics">${this._metrics
                  .map(
                      (m) =>
                          `<div class="tc-hero-metric">` +
                          `<span class="tc-hero-metric-value">${esc(m.value)}</span>` +
                          `<span class="tc-hero-metric-label">${esc(m.label)}</span>` +
                          `</div>`,
                  )
                  .join('')}</div>` +
              '</div></div>'
            : ''

        // Main region: centered text column (eyebrow → title → description →
        // actions → stat cards) inside a max-width grid, mirroring the react Hero.
        this.innerHTML = [
            '<section class="tc-hero">',
            backgroundHtml,
            '<div class="tc-hero-main">',
            '<div class="tc-hero-grid">',
            '<div class="tc-hero-body">',
            eyebrowHtml,
            titleHtml,
            descriptionHtml,
            actionsHtml,
            statCardsHtml,
            '</div>',
            '</div>',
            '</div>',
            metricsHtml,
            '</section>',
        ].join('')

        // Delegate action clicks on the inner actions container (re-wired every render).
        const actionsEl = this.querySelector('.tc-hero-actions')
        if (actionsEl) {
            actionsEl.addEventListener('click', (e: Event) => {
                const btn = (e.target as Element).closest('[data-which]') as HTMLElement | null
                if (!btn) return
                const which = btn.dataset.which as 'primary' | 'secondary'
                if (which === 'primary' || which === 'secondary') {
                    this._dispatchAction(which)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Hero
    }
}

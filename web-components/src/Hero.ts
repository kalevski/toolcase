import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-hero'

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
type HeadingLevel = (typeof HEADING_LEVELS)[number]

export interface HeroAction {
    label: string
    href?: string
    onClick?: () => void
    // Optional lucide icon (kebab-case or PascalCase) rendered before the label.
    icon?: string
}

export interface HeroStatCard {
    label: string
    value: string
}

export interface HeroMetric {
    label: string
    value: string
}

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

// Built-in decorative "blueprint" preview rendered inside the media panel when
// `preview` is set and no `media-src` is supplied. Purely cosmetic (aria-hidden);
// every colour flows from --tc-* tokens via _hero.scss so themes re-skin it.
const BLUEPRINT_CANVAS =
    '<div class="tc-hero-canvas" aria-hidden="true">' +
    '<span class="tc-hero-canvas-floor"></span>' +
    '<svg class="tc-hero-canvas-art" viewBox="0 0 440 300" preserveAspectRatio="xMidYMid slice">' +
    '<g class="tc-hero-vec tc-hero-vec--ship">' +
    '<polygon points="210,150 232,196 210,184 188,196" />' +
    '<line x1="210" y1="196" x2="210" y2="216" />' +
    '</g>' +
    '<polygon class="tc-hero-vec tc-hero-vec--a" points="330,58 352,70 350,92 330,102 312,88 314,66" />' +
    '<polygon class="tc-hero-vec tc-hero-vec--b" points="96,96 112,104 110,122 92,124 82,108" />' +
    '<polygon class="tc-hero-vec tc-hero-vec--c" points="140,46 152,52 150,66 136,66 130,54" />' +
    '</svg>' +
    '<span class="tc-hero-canvas-corner tc-hero-canvas-corner--tl"></span>' +
    '<span class="tc-hero-canvas-corner tc-hero-canvas-corner--tr"></span>' +
    '<span class="tc-hero-canvas-corner tc-hero-canvas-corner--bl"></span>' +
    '<span class="tc-hero-canvas-corner tc-hero-canvas-corner--br"></span>' +
    '</div>'

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
        return [
            'eyebrow',
            'title',
            'title-as',
            'description',
            'note',
            'background-pattern-src',
            'backdrop',
            'media-src',
            'media-alt',
            'media-label',
            'media-caption',
            'preview',
        ]
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

    get note(): string | null {
        return this.getAttribute('note')
    }
    set note(v: string | null) {
        if (v != null) this.setAttribute('note', v)
        else this.removeAttribute('note')
    }

    get backgroundPatternSrc(): string | null {
        return this.getAttribute('background-pattern-src')
    }
    set backgroundPatternSrc(v: string | null) {
        if (v != null) this.setAttribute('background-pattern-src', v)
        else this.removeAttribute('background-pattern-src')
    }

    get backdrop(): string | null {
        return this.getAttribute('backdrop')
    }
    set backdrop(v: string | null) {
        if (v != null) this.setAttribute('backdrop', v)
        else this.removeAttribute('backdrop')
    }

    get mediaSrc(): string | null {
        return this.getAttribute('media-src')
    }
    set mediaSrc(v: string | null) {
        if (v != null) this.setAttribute('media-src', v)
        else this.removeAttribute('media-src')
    }

    get mediaAlt(): string | null {
        return this.getAttribute('media-alt')
    }
    set mediaAlt(v: string | null) {
        if (v != null) this.setAttribute('media-alt', v)
        else this.removeAttribute('media-alt')
    }

    get mediaLabel(): string | null {
        return this.getAttribute('media-label')
    }
    set mediaLabel(v: string | null) {
        if (v != null) this.setAttribute('media-label', v)
        else this.removeAttribute('media-label')
    }

    get mediaCaption(): string | null {
        return this.getAttribute('media-caption')
    }
    set mediaCaption(v: string | null) {
        if (v != null) this.setAttribute('media-caption', v)
        else this.removeAttribute('media-caption')
    }

    get preview(): boolean {
        return this.hasAttribute('preview')
    }
    set preview(v: boolean) {
        if (v) this.setAttribute('preview', '')
        else this.removeAttribute('preview')
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

    private _actionHtml(
        action: HeroAction,
        which: 'primary' | 'secondary',
        variant: 'primary' | 'secondary',
    ): string {
        const label = esc(action.label)
        const iconHtml = action.icon
            ? lucideByName(action.icon, `tc-hero-btn-icon`)
            : ''
        const cls =
            variant === 'primary'
                ? 'btn btn-primary tc-hero-btn-primary'
                : 'btn btn-outline-primary tc-hero-btn-secondary'
        const inner = iconHtml + `<span class="tc-hero-btn-label">${label}</span>`
        if (action.href) {
            return `<a href="${esc(action.href)}" class="${cls}" data-which="${which}">${inner}</a>`
        }
        return `<button type="button" class="${cls}" data-which="${which}">${inner}</button>`
    }

    private render(): void {
        const eyebrow = this.getAttribute('eyebrow')
        const titleText = this.getAttribute('title') ?? ''
        const titleAs = this.titleAs
        const description = this.getAttribute('description') ?? ''
        const note = this.getAttribute('note') ?? ''
        const bgPatternSrc = this.getAttribute('background-pattern-src')
        const backdrop = this.getAttribute('backdrop')
        const mediaSrc = this.getAttribute('media-src')
        const mediaAlt = this.getAttribute('media-alt') ?? ''
        const mediaLabel = this.getAttribute('media-label') ?? ''
        const mediaCaption = this.getAttribute('media-caption') ?? ''
        const hasPreview = this.hasAttribute('preview')
        const showMedia = !!mediaSrc || hasPreview

        // Blueprint grid + glow backdrop layer (opt-in via backdrop="grid").
        const backdropHtml =
            backdrop === 'grid' ? '<div class="tc-hero-backdrop" aria-hidden="true"></div>' : ''

        // Background layer (pattern image + scattered icons).
        const patternStyle = bgPatternSrc
            ? ` style="background-image: url('${esc(bgPatternSrc)}');"`
            : ''

        const bgIconsHtml = this._bgIcons
            .slice(0, BG_ICON_POSITIONS.length)
            .map((name, i) => {
                const svg = lucideByName(name, 'tc-hero-bg-icon')
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
                    svg +
                    `</span>`
                )
            })
            .join('')

        const backgroundHtml =
            bgPatternSrc || this._bgIcons.length
                ? `<div class="tc-hero-bg"${patternStyle}>${bgIconsHtml}</div>`
                : ''

        // Eyebrow — a bordered mono badge with a pulsing status dot.
        const eyebrowHtml = eyebrow
            ? '<span class="tc-hero-eyebrow">' +
              '<span class="tc-hero-eyebrow-dot" aria-hidden="true"></span>' +
              esc(eyebrow) +
              '</span>'
            : ''

        // Title heading
        const titleHtml = `<${titleAs} class="tc-hero-title">${esc(titleText)}</${titleAs}>`

        // Description
        const descriptionHtml = description
            ? `<p class="tc-hero-description">${esc(description)}</p>`
            : ''

        // Actions
        const primaryHtml = this._primaryAction
            ? this._actionHtml(this._primaryAction, 'primary', 'primary')
            : ''
        const secondaryHtml = this._secondaryAction
            ? this._actionHtml(this._secondaryAction, 'secondary', 'secondary')
            : ''
        const actionsHtml =
            primaryHtml || secondaryHtml
                ? `<div class="tc-hero-actions">${primaryHtml}${secondaryHtml}</div>`
                : ''

        // Footnote micro-copy under the actions.
        const noteHtml = note ? `<p class="tc-hero-note">${esc(note)}</p>` : ''

        // Stat cards (row, sits inside the main column under the note)
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

        // Media column — a framed preview panel with an optional titlebar and
        // either a supplied image or the built-in blueprint canvas.
        let mediaHtml = ''
        if (showMedia) {
            const barHtml =
                mediaLabel || mediaCaption
                    ? '<div class="tc-hero-panel-bar">' +
                      (mediaLabel
                          ? '<span class="tc-hero-panel-status">' +
                            '<span class="tc-hero-panel-dot" aria-hidden="true"></span>' +
                            esc(mediaLabel) +
                            '</span>'
                          : '<span></span>') +
                      (mediaCaption
                          ? `<span class="tc-hero-panel-caption">${esc(mediaCaption)}</span>`
                          : '') +
                      '</div>'
                    : ''
            const bodyHtml = mediaSrc
                ? `<img class="tc-hero-panel-img" src="${esc(mediaSrc)}" alt="${esc(mediaAlt)}" />`
                : BLUEPRINT_CANVAS
            mediaHtml =
                '<div class="tc-hero-media">' +
                '<div class="tc-hero-panel">' +
                barHtml +
                `<div class="tc-hero-panel-body">${bodyHtml}</div>` +
                '</div>' +
                '</div>'
        }

        // Metrics live in a separate centered band below a hairline separator.
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

        // Grid switches to a two-column split whenever there is a media column.
        const gridClass = showMedia ? 'tc-hero-grid tc-hero-grid--split' : 'tc-hero-grid'

        this.innerHTML = [
            '<section class="tc-hero">',
            backdropHtml,
            backgroundHtml,
            '<div class="tc-hero-main">',
            `<div class="${gridClass}">`,
            '<div class="tc-hero-body">',
            eyebrowHtml,
            titleHtml,
            descriptionHtml,
            actionsHtml,
            noteHtml,
            statCardsHtml,
            '</div>',
            mediaHtml,
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

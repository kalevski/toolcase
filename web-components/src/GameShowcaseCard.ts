import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-game-showcase-card'

// Pre-compute compliance state icons (always rendered, no condition)
const checkIconHtml = lucideByName('check')
const alertTriangleIconHtml = lucideByName('alert-triangle')
const xIconHtml = lucideByName('x')

export interface GameStamp {
    label: string
    icon?: string
    tone?: string
}

export interface ComplianceState {
    label: string
    state: 'pass' | 'warn' | 'fail' | string
    icon?: string
}

export class GameShowcaseCard extends HTMLElement {
    private _initialised = false
    private _stamps: GameStamp[] = []
    private _tags: string[] = []
    private _compliance: ComplianceState[] = []
    private _onClickProp: (() => void) | null = null

    private _artSlot: Element[] = []
    private _artPlaceholderSlot: Element[] = []
    private _metaLeftSlot: Element[] = []
    private _metaRightSlot: Element[] = []
    private _titleSlot: Element[] = []
    private _pitchSlot: Element[] = []

    // Arrow-property handlers: stable references for add/removeEventListener
    private _handleClick = (): void => {
        this.dispatchEvent(
            new CustomEvent('tc-click', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this._onClickProp === 'function') this._onClickProp()
    }

    private _handleKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if (!this._onClickProp) return
        e.preventDefault()
        this.dispatchEvent(
            new CustomEvent('tc-click', { bubbles: true, composed: true, detail: {} }),
        )
        this._onClickProp()
    }

    static get observedAttributes(): string[] {
        // title is a native HTMLElement attribute — no getter/setter defined below (would collide)
        return ['title', 'pitch']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._captureInitialSlots()
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
        // Attach outside !_initialised so listeners re-attach after reconnect
        this.addEventListener('click', this._handleClick)
        this.addEventListener('keydown', this._handleKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
        this.removeEventListener('keydown', this._handleKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    // ── JS Properties ─────────────────────────────────────────────────────────

    get stamps(): GameStamp[] {
        return this._stamps
    }
    set stamps(v: GameStamp[]) {
        this._stamps = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get tags(): string[] {
        return this._tags
    }
    set tags(v: string[]) {
        this._tags = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get compliance(): ComplianceState[] {
        return this._compliance
    }
    set compliance(v: ComplianceState[]) {
        this._compliance = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    // pitch: custom attribute with getter/setter (no native collision)
    get pitch(): string | null {
        return this.getAttribute('pitch')
    }
    set pitch(v: string | null) {
        if (v != null) this.setAttribute('pitch', v)
        else this.removeAttribute('pitch')
    }

    // onClick: callback property; changing it updates the interactive state
    get onClick(): (() => void) | null {
        return this._onClickProp
    }
    set onClick(v: (() => void) | null) {
        this._onClickProp = v ?? null
        if (this._initialised) this._rerenderWithSlots()
    }

    // ── Slot management ───────────────────────────────────────────────────────

    private _captureInitialSlots(): void {
        this._artSlot = Array.from(this.querySelectorAll('[slot="art"]'))
        this._artPlaceholderSlot = Array.from(this.querySelectorAll('[slot="art-placeholder"]'))
        this._metaLeftSlot = Array.from(this.querySelectorAll('[slot="meta-left"]'))
        this._metaRightSlot = Array.from(this.querySelectorAll('[slot="meta-right"]'))
        this._titleSlot = Array.from(this.querySelectorAll('[slot="title"]'))
        this._pitchSlot = Array.from(this.querySelectorAll('[slot="pitch"]'))
    }

    private _recaptureSlots(): void {
        this._artSlot = Array.from(
            this.querySelectorAll('.tc-game-showcase-card-art-main [slot="art"]'),
        )
        this._artPlaceholderSlot = Array.from(
            this.querySelectorAll(
                '.tc-game-showcase-card-art-placeholder [slot="art-placeholder"]',
            ),
        )
        this._metaLeftSlot = Array.from(
            this.querySelectorAll('.tc-game-showcase-card-meta-left [slot="meta-left"]'),
        )
        this._metaRightSlot = Array.from(
            this.querySelectorAll('.tc-game-showcase-card-meta-right [slot="meta-right"]'),
        )
        this._titleSlot = Array.from(
            this.querySelectorAll('.tc-game-showcase-card-title [slot="title"]'),
        )
        this._pitchSlot = Array.from(
            this.querySelectorAll('.tc-game-showcase-card-pitch [slot="pitch"]'),
        )
    }

    private _rerenderWithSlots(): void {
        this._recaptureSlots()
        this.render()
        this._distributeSlots()
    }

    private _distributeSlots(): void {
        const artMainEl = this.querySelector('.tc-game-showcase-card-art-main')
        if (artMainEl) this._artSlot.forEach((n) => artMainEl.appendChild(n))
        const artPhEl = this.querySelector('.tc-game-showcase-card-art-placeholder')
        if (artPhEl) this._artPlaceholderSlot.forEach((n) => artPhEl.appendChild(n))
        const metaLeftEl = this.querySelector('.tc-game-showcase-card-meta-left')
        if (metaLeftEl) this._metaLeftSlot.forEach((n) => metaLeftEl.appendChild(n))
        const metaRightEl = this.querySelector('.tc-game-showcase-card-meta-right')
        if (metaRightEl) this._metaRightSlot.forEach((n) => metaRightEl.appendChild(n))
        const titleEl = this.querySelector('.tc-game-showcase-card-title')
        if (titleEl) this._titleSlot.forEach((n) => titleEl.appendChild(n))
        const pitchEl = this.querySelector('.tc-game-showcase-card-pitch')
        if (pitchEl) this._pitchSlot.forEach((n) => pitchEl.appendChild(n))
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private render(): void {
        const isClickable = this._onClickProp !== null
        const hasArt = this._artSlot.length > 0

        // Update host accessibility attributes for the interactive state
        if (isClickable) {
            this.setAttribute('role', 'button')
            this.setAttribute('tabindex', '0')
        } else {
            this.removeAttribute('role')
            this.removeAttribute('tabindex')
        }
        this.classList.add('tc-game-showcase-card-host')

        // Title: slot children take precedence over attribute
        const titleText = this.getAttribute('title')
        const titleInner = this._titleSlot.length === 0 && titleText ? esc(titleText) : ''

        // Pitch: slot children take precedence over attribute
        const pitchText = this.getAttribute('pitch')
        const pitchInner = this._pitchSlot.length === 0 && pitchText ? esc(pitchText) : ''

        // Stamps
        const stampsHtml = this._stamps
            .map((s) => {
                // Sanitize tone for use in class name (allow alphanumeric + hyphen only)
                const safeTone = s.tone ? s.tone.replace(/[^a-z0-9-]/gi, '') : ''
                const toneClass = safeTone ? ` tc-game-showcase-card-stamp--${safeTone}` : ''
                const stampIconHtml = s.icon
                    ? `<span class="tc-game-showcase-card-stamp-icon" aria-hidden="true">${lucideByName(s.icon)}</span>`
                    : ''
                return (
                    `<span class="tc-game-showcase-card-stamp${toneClass}">` +
                    stampIconHtml +
                    `<span class="tc-game-showcase-card-stamp-label">${esc(s.label)}</span>` +
                    `</span>`
                )
            })
            .join('')

        // Tags
        const tagsHtml = this._tags
            .map((t) => `<span class="tc-game-showcase-card-tag">${esc(t)}</span>`)
            .join('')

        // Compliance indicators
        const complianceHtml = this._compliance
            .map((c) => {
                let stateIcon = ''
                let stateClass = ''
                if (c.state === 'pass') {
                    stateIcon = checkIconHtml
                    stateClass = 'tc-game-showcase-card-compliance-item--pass'
                } else if (c.state === 'warn') {
                    stateIcon = alertTriangleIconHtml
                    stateClass = 'tc-game-showcase-card-compliance-item--warn'
                } else if (c.state === 'fail') {
                    stateIcon = xIconHtml
                    stateClass = 'tc-game-showcase-card-compliance-item--fail'
                } else if (c.icon) {
                    stateIcon = lucideByName(c.icon)
                }
                const ariaLabel = `${esc(c.label)}: ${esc(c.state)}`
                return (
                    `<span class="tc-game-showcase-card-compliance-item ${stateClass}" aria-label="${ariaLabel}">` +
                    `<span class="tc-game-showcase-card-compliance-icon" aria-hidden="true">${stateIcon}</span>` +
                    `<span class="tc-game-showcase-card-compliance-label">${esc(c.label)}</span>` +
                    `</span>`
                )
            })
            .join('')

        const hasArtClass = hasArt ? ' tc-game-showcase-card--has-art' : ''

        this.innerHTML = [
            `<div class="tc-game-showcase-card${hasArtClass}">`,
            // Art region: always render both containers; CSS hides placeholder when art present
            `<div class="tc-game-showcase-card-art">`,
            `<div class="tc-game-showcase-card-art-main"></div>`,
            `<div class="tc-game-showcase-card-art-placeholder"></div>`,
            `</div>`,
            // Stamps overlay (omit region when empty)
            this._stamps.length > 0
                ? `<div class="tc-game-showcase-card-stamps">${stampsHtml}</div>`
                : '',
            // Meta row: always render for layout consistency
            `<div class="tc-game-showcase-card-meta">`,
            `<div class="tc-game-showcase-card-meta-left"></div>`,
            `<div class="tc-game-showcase-card-meta-right"></div>`,
            `</div>`,
            // Title + pitch
            `<div class="tc-game-showcase-card-title">${titleInner}</div>`,
            `<div class="tc-game-showcase-card-pitch">${pitchInner}</div>`,
            // Tags (omit region when empty)
            this._tags.length > 0
                ? `<div class="tc-game-showcase-card-tags">${tagsHtml}</div>`
                : '',
            // Compliance (omit region when empty)
            this._compliance.length > 0
                ? `<div class="tc-game-showcase-card-compliance">${complianceHtml}</div>`
                : '',
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GameShowcaseCard
    }
}

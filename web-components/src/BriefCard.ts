import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-brief-card'

export type BriefCardDifficulty = 'easy' | 'medium' | 'hard'

const DIFFICULTIES: BriefCardDifficulty[] = ['easy', 'medium', 'hard']

const DIFF_VARIANT: Record<BriefCardDifficulty, string> = {
    easy: 'success',
    medium: 'warning',
    hard: 'danger',
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class BriefCard extends HTMLElement {
    private _initialised = false
    private _onClickProp: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['brief-id', 'difficulty', 'title', 'body', 'meta-left', 'meta-right', 'icon', 'clickable']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            const iconSlot = Array.from(this.querySelectorAll('[slot="icon"]'))
            const titleSlot = Array.from(this.querySelectorAll('[slot="title"]'))
            const bodySlot = Array.from(this.querySelectorAll('[slot="body"]'))
            const metaLeftSlot = Array.from(this.querySelectorAll('[slot="meta-left"]'))
            const metaRightSlot = Array.from(this.querySelectorAll('[slot="meta-right"]'))

            this.render()
            this._distributeSlots(iconSlot, titleSlot, bodySlot, metaLeftSlot, metaRightSlot)
            this._attachInnerListener()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // Re-capture from their inner containers (already moved there)
        const iconSlot = Array.from(this.querySelectorAll('.tc-brief-card__icon-slot [slot="icon"]'))
        const titleSlot = Array.from(this.querySelectorAll('.tc-brief-card__title-slot [slot="title"]'))
        const bodySlot = Array.from(this.querySelectorAll('.tc-brief-card__body-slot [slot="body"]'))
        const metaLeftSlot = Array.from(this.querySelectorAll('.tc-brief-card__meta-left-slot [slot="meta-left"]'))
        const metaRightSlot = Array.from(this.querySelectorAll('.tc-brief-card__meta-right-slot [slot="meta-right"]'))

        this.render()
        this._distributeSlots(iconSlot, titleSlot, bodySlot, metaLeftSlot, metaRightSlot)
        this._attachInnerListener()
    }

    private _distributeSlots(
        iconSlot: Element[],
        titleSlot: Element[],
        bodySlot: Element[],
        metaLeftSlot: Element[],
        metaRightSlot: Element[],
    ): void {
        const iconEl = this.querySelector('.tc-brief-card__icon-slot')
        if (iconEl) iconSlot.forEach(n => iconEl.appendChild(n))
        const titleEl = this.querySelector('.tc-brief-card__title-slot')
        if (titleEl) titleSlot.forEach(n => titleEl.appendChild(n))
        const bodyEl = this.querySelector('.tc-brief-card__body-slot')
        if (bodyEl) bodySlot.forEach(n => bodyEl.appendChild(n))
        const metaLeftEl = this.querySelector('.tc-brief-card__meta-left-slot')
        if (metaLeftEl) metaLeftSlot.forEach(n => metaLeftEl.appendChild(n))
        const metaRightEl = this.querySelector('.tc-brief-card__meta-right-slot')
        if (metaRightEl) metaRightSlot.forEach(n => metaRightEl.appendChild(n))
    }

    private _attachInnerListener(): void {
        const inner = this.querySelector('.tc-brief-card')
        if (!inner) return
        inner.addEventListener('click', () => this._handleClick())
        inner.addEventListener('keydown', (e: Event) => {
            const ke = e as KeyboardEvent
            if (ke.key === 'Enter' || ke.key === ' ') {
                ke.preventDefault()
                this._handleClick()
            }
        })
    }

    private _handleClick(): void {
        this.dispatchEvent(new CustomEvent('tc-click', {
            bubbles: true,
            composed: true,
            detail: { id: this.briefId },
        }))
        if (typeof this._onClickProp === 'function') this._onClickProp()
    }

    // --- Public API ---

    get onClick(): (() => void) | null {
        return this._onClickProp
    }
    set onClick(v: (() => void) | null) {
        this._onClickProp = v
        // Toggle interactive class without full re-render (unless clickable attr also drives it)
        const inner = this.querySelector('.tc-brief-card')
        if (inner) {
            const isInteractive = v !== null || this.hasAttribute('clickable')
            if (isInteractive) inner.classList.add('tc-brief-card--interactive')
            else inner.classList.remove('tc-brief-card--interactive')
        }
    }

    get briefId(): string | null {
        return this.getAttribute('brief-id')
    }
    set briefId(v: string | null) {
        if (v != null) this.setAttribute('brief-id', v)
        else this.removeAttribute('brief-id')
    }

    get difficulty(): BriefCardDifficulty {
        const v = this.getAttribute('difficulty') as BriefCardDifficulty
        return DIFFICULTIES.includes(v) ? v : 'easy'
    }
    set difficulty(v: BriefCardDifficulty) {
        this.setAttribute('difficulty', v)
    }

    // Override HTMLElement.title (string, not string|null) to reflect the attribute.
    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get body(): string | null {
        return this.getAttribute('body')
    }
    set body(v: string | null) {
        if (v != null) this.setAttribute('body', v)
        else this.removeAttribute('body')
    }

    get metaLeft(): string | null {
        return this.getAttribute('meta-left')
    }
    set metaLeft(v: string | null) {
        if (v != null) this.setAttribute('meta-left', v)
        else this.removeAttribute('meta-left')
    }

    get metaRight(): string | null {
        return this.getAttribute('meta-right')
    }
    set metaRight(v: string | null) {
        if (v != null) this.setAttribute('meta-right', v)
        else this.removeAttribute('meta-right')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get clickable(): boolean {
        return this.hasAttribute('clickable')
    }
    set clickable(v: boolean) {
        if (v) this.setAttribute('clickable', '')
        else this.removeAttribute('clickable')
    }

    private render(): void {
        const difficulty = this.difficulty
        const diffVariant = DIFF_VARIANT[difficulty]
        const briefId = this.getAttribute('brief-id')
        const titleAttr = this.getAttribute('title')
        const bodyAttr = this.getAttribute('body')
        const metaLeftAttr = this.getAttribute('meta-left')
        const metaRightAttr = this.getAttribute('meta-right')
        const iconAttr = this.getAttribute('icon')
        const interactive = this._onClickProp !== null || this.hasAttribute('clickable')

        // Icon region: attribute-driven SVG or slot container
        const iconHtml = iconAttr ? resolveIcon(iconAttr) : ''

        // Accessible name from title
        const titleText = titleAttr != null ? titleAttr : ''
        const ariaLabelAttr = titleText ? ` aria-label="${esc(titleText)}"` : ''

        // Interactive affordance
        const interactiveClass = interactive ? ' tc-brief-card--interactive' : ''

        // ID micro-label
        const idHtml = briefId != null ? `<span class="tc-brief-card__id">${esc(briefId)}</span>` : ''

        // Header row
        const titleHtml = titleAttr != null ? esc(titleAttr) : ''
        const headerHtml = `<div class="tc-brief-card__header"><span class="tc-brief-card__icon-slot" aria-hidden="true">${iconHtml}</span><span class="tc-brief-card__title"><span class="tc-brief-card__title-slot">${titleHtml}</span></span></div>`

        // Difficulty pill
        const diffHtml = `<div class="tc-brief-card__difficulty"><span class="tc-brief-card__diff-badge tc-brief-card__diff-badge--${diffVariant}">${difficulty.toUpperCase()}</span></div>`

        // Body
        const bodyHtml = bodyAttr != null ? esc(bodyAttr) : ''
        const bodyRegion = `<div class="tc-brief-card__body-slot">${bodyHtml}</div>`

        // Footer meta
        const metaLeftHtml = metaLeftAttr != null ? esc(metaLeftAttr) : ''
        const metaRightHtml = metaRightAttr != null ? esc(metaRightAttr) : ''
        const metaRegion = `<div class="tc-brief-card__meta"><span class="tc-brief-card__meta-left-slot">${metaLeftHtml}</span><span class="tc-brief-card__meta-right-slot">${metaRightHtml}</span></div>`

        this.innerHTML = `<button type="button" class="tc-brief-card tc-brief-card--${difficulty}${interactiveClass}"${ariaLabelAttr}>${idHtml}${headerHtml}${diffHtml}${bodyRegion}${metaRegion}</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BriefCard
    }
}

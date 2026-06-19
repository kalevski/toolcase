import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-pinned-feature-showcase'

let _uid = 0

export interface PinnedFeatureShowcaseItem {
    title: string
    description?: string
    icon?: string
}

export class PinnedFeatureShowcase extends HTMLElement {
    private _initialised = false
    private _items: PinnedFeatureShowcaseItem[] = []
    private _titleId: string
    private _mq: MediaQueryList | null = null
    private _mqSync: (() => void) | null = null
    private _scrollAttached = false

    constructor() {
        super()
        this._titleId = `tc-pfs-${++_uid}`
    }

    static get observedAttributes(): string[] {
        return ['title', 'description', 'eyebrow', 'image-src', 'image-alt']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const mediaSlot = Array.from(this.querySelectorAll('[slot="media"]'))
            const ctasSlot = Array.from(this.querySelectorAll('[slot="ctas"]'))
            this.render(mediaSlot.length > 0)
            const mediaEl = this.querySelector('.tc-pinned-feature-showcase-media')
            if (mediaEl) mediaSlot.forEach((n) => mediaEl.appendChild(n))
            const ctasEl = this.querySelector('.tc-pinned-feature-showcase-ctas')
            if (ctasEl) ctasSlot.forEach((n) => ctasEl.appendChild(n))
            this._initialised = true
        }
        this._detachCenteringListeners()
        this._attachCenteringListeners()
    }

    disconnectedCallback(): void {
        this._detachCenteringListeners()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get description(): string {
        return this.getAttribute('description') ?? ''
    }
    set description(v: string) {
        this.setAttribute('description', v)
    }

    get eyebrow(): string | null {
        return this.getAttribute('eyebrow')
    }
    set eyebrow(v: string | null) {
        if (v != null) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get imageSrc(): string | null {
        return this.getAttribute('image-src')
    }
    set imageSrc(v: string | null) {
        if (v != null) this.setAttribute('image-src', v)
        else this.removeAttribute('image-src')
    }

    get imageAlt(): string {
        return this.getAttribute('image-alt') ?? ''
    }
    set imageAlt(v: string) {
        this.setAttribute('image-alt', v)
    }

    get items(): PinnedFeatureShowcaseItem[] {
        return this._items
    }
    set items(v: PinnedFeatureShowcaseItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // Re-capture slots from within their inner containers (already moved there)
        const mediaSlot = Array.from(
            this.querySelectorAll('.tc-pinned-feature-showcase-media [slot="media"]'),
        )
        const ctasSlot = Array.from(
            this.querySelectorAll('.tc-pinned-feature-showcase-ctas [slot="ctas"]'),
        )
        this.render(mediaSlot.length > 0)
        const mediaEl = this.querySelector('.tc-pinned-feature-showcase-media')
        if (mediaEl) mediaSlot.forEach((n) => mediaEl.appendChild(n))
        const ctasEl = this.querySelector('.tc-pinned-feature-showcase-ctas')
        if (ctasEl) ctasSlot.forEach((n) => ctasEl.appendChild(n))
    }

    private _handleScroll = (): void => {
        const panel = this.querySelector<HTMLElement>('.tc-pinned-feature-showcase-panel')
        if (!panel) return
        const { top } = panel.getBoundingClientRect()
        const contentHeight = panel.scrollHeight
        const viewportHeight = window.innerHeight
        const offsetTrigger = 56
        const canCenter = contentHeight + offsetTrigger * 2 <= viewportHeight
        const shouldCenter = top <= offsetTrigger && canCenter
        panel.classList.toggle('tc-pinned-feature-showcase-panel--centered', shouldCenter)
    }

    private _scheduleScroll = (): void => {
        window.requestAnimationFrame(this._handleScroll)
    }

    private _attachCenteringListeners(): void {
        if (typeof window === 'undefined') return
        this._mq = window.matchMedia('(min-width: 769px)')
        const sync = () => {
            if (!this._mq) return
            if (this._mq.matches && !this._scrollAttached) {
                window.addEventListener('scroll', this._scheduleScroll, { passive: true })
                window.addEventListener('resize', this._scheduleScroll, { passive: true })
                this._scrollAttached = true
                this._handleScroll()
            } else if (!this._mq.matches && this._scrollAttached) {
                window.removeEventListener('scroll', this._scheduleScroll)
                window.removeEventListener('resize', this._scheduleScroll)
                this._scrollAttached = false
                const panel = this.querySelector('.tc-pinned-feature-showcase-panel')
                if (panel) panel.classList.remove('tc-pinned-feature-showcase-panel--centered')
            }
        }
        this._mqSync = sync
        this._mq.addEventListener('change', sync)
        sync()
    }

    private _detachCenteringListeners(): void {
        if (this._scrollAttached) {
            window.removeEventListener('scroll', this._scheduleScroll)
            window.removeEventListener('resize', this._scheduleScroll)
            this._scrollAttached = false
        }
        if (this._mq && this._mqSync) {
            this._mq.removeEventListener('change', this._mqSync)
            this._mqSync = null
            this._mq = null
        }
    }

    private render(hasMediaSlot: boolean): void {
        const title = this.getAttribute('title') ?? ''
        const description = this.getAttribute('description') ?? ''
        const eyebrow = this.getAttribute('eyebrow')
        const imageSrc = this.getAttribute('image-src')
        const imageAlt = this.getAttribute('image-alt') ?? ''

        const eyebrowHtml = eyebrow
            ? `<span class="tc-pinned-feature-showcase-eyebrow">${esc(eyebrow)}</span>`
            : ''

        // Render the image only when no media slot content is provided
        const mediaInnerHtml =
            !hasMediaSlot && imageSrc
                ? `<img class="tc-pinned-feature-showcase-image" src="${esc(imageSrc)}" alt="${esc(imageAlt)}" loading="lazy">`
                : ''

        const itemsHtml = this._items
            .map((item) => {
                const iconHtml = item.icon
                    ? `<span class="tc-pinned-feature-showcase-item-icon" aria-hidden="true">${lucideByName(item.icon)}</span>`
                    : ''
                const descHtml = item.description
                    ? `<p class="tc-pinned-feature-showcase-item-description">${esc(item.description)}</p>`
                    : ''
                return (
                    `<li class="tc-pinned-feature-showcase-item">` +
                    iconHtml +
                    `<div class="tc-pinned-feature-showcase-item-content">` +
                    `<h3 class="tc-pinned-feature-showcase-item-title">${esc(item.title)}</h3>` +
                    descHtml +
                    `</div>` +
                    `</li>`
                )
            })
            .join('')

        this.innerHTML =
            `<section class="tc-pinned-feature-showcase" aria-labelledby="${this._titleId}">` +
            `<div class="tc-pinned-feature-showcase-inner">` +
            `<aside class="tc-pinned-feature-showcase-panel">` +
            `<div class="tc-pinned-feature-showcase-lead">` +
            eyebrowHtml +
            `<h2 id="${this._titleId}" class="tc-pinned-feature-showcase-title">${esc(title)}</h2>` +
            `<p class="tc-pinned-feature-showcase-description">${esc(description)}</p>` +
            `<div class="tc-pinned-feature-showcase-ctas"></div>` +
            `</div>` +
            `<div class="tc-pinned-feature-showcase-media">${mediaInnerHtml}</div>` +
            `</aside>` +
            `<ul class="tc-pinned-feature-showcase-list" aria-label="${esc(title)} features">${itemsHtml}</ul>` +
            `</div>` +
            `</section>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PinnedFeatureShowcase
    }
}

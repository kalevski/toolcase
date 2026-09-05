import { markOwned, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { chevronLeftIcon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-testimonial-carousel'

const DEFAULT_INTERVAL = 5000
const MIN_INTERVAL = 500
const STAR_COUNT = 5

export interface Testimonial {
    id: string
    quote: string
    author: string
    role?: string
    company?: string
    avatarUrl?: string
    rating?: number
}

const starIconHtml = lucideByName('star')

// tc-testimonial-carousel — one testimonial shown at a time with prev/next
// arrow controls and a row of dot indicators. Prev/next wrap around; clicking a
// dot jumps to that slide. With the `autoplay` attribute the slide auto-advances
// every `interval` ms, pausing on hover/focus and when the tab is hidden. The
// React `items: Testimonial[]` prop maps to a JS property (not an attribute); a
// slide change emits a `tc-change` CustomEvent with `detail: { index, id }`.
export class TestimonialCarousel extends HTMLElement {
    private _initialised = false
    private _items: Testimonial[] = []
    private _active = 0
    private _hovered = false
    private _focused = false
    private _timerId: ReturnType<typeof setInterval> | null = null

    static get observedAttributes(): string[] {
        return ['autoplay', 'interval']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // autoplay / interval only affect the timer — no visual re-render needed
        if (name === 'autoplay' || name === 'interval') this._syncTimer()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get items(): Testimonial[] {
        return this._items
    }
    set items(v: Testimonial[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._active >= this._items.length) this._active = 0
        if (this._initialised) {
            this.render()
            this._syncTimer()
        }
    }

    get autoplay(): boolean {
        return this.hasAttribute('autoplay')
    }
    set autoplay(v: boolean) {
        if (v) this.setAttribute('autoplay', '')
        else this.removeAttribute('autoplay')
    }

    get interval(): number {
        const n = parseInt(this.getAttribute('interval') ?? '', 10)
        return Number.isFinite(n) && n > 0 ? Math.max(MIN_INTERVAL, n) : DEFAULT_INTERVAL
    }
    set interval(v: number) {
        this.setAttribute('interval', String(v))
    }

    // ── Navigation ─────────────────────────────────────────────────────────────

    private _goTo(index: number, emit: boolean): void {
        const len = this._items.length
        if (len === 0) return
        const n = ((index % len) + len) % len
        if (n === this._active) return
        this._active = n
        this._renderSlide()
        this._updateDots()
        if (emit) this._emitChange()
    }

    // Manual navigation (clicks / arrow keys) resets the autoplay cadence.
    private _navigate(index: number): void {
        this._goTo(index, true)
        this._syncTimer()
    }

    private _emitChange(): void {
        const item = this._items[this._active]
        if (!item) return
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { index: this._active, id: item.id },
            }),
        )
    }

    // ── Timer ────────────────────────────────────────────────────────────────

    private _syncTimer(): void {
        this._clearTimer()
        if (
            this.autoplay &&
            this._items.length > 1 &&
            !document.hidden &&
            !this._hovered &&
            !this._focused
        ) {
            this._timerId = setInterval(() => this._goTo(this._active + 1, true), this.interval)
        }
    }

    private _clearTimer(): void {
        if (this._timerId !== null) {
            clearInterval(this._timerId)
            this._timerId = null
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('mouseenter', this._onMouseEnter)
        this.addEventListener('mouseleave', this._onMouseLeave)
        this.addEventListener('focusin', this._onFocusIn)
        this.addEventListener('focusout', this._onFocusOut)
        document.addEventListener('visibilitychange', this._onVisibility)
        this._syncTimer()
    }

    private _detachHandlers(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('mouseenter', this._onMouseEnter)
        this.removeEventListener('mouseleave', this._onMouseLeave)
        this.removeEventListener('focusin', this._onFocusIn)
        this.removeEventListener('focusout', this._onFocusOut)
        document.removeEventListener('visibilitychange', this._onVisibility)
        this._clearTimer()
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest('.tc-testimonial-carousel-prev')) {
            this._navigate(this._active - 1)
        } else if (target.closest('.tc-testimonial-carousel-next')) {
            this._navigate(this._active + 1)
        } else {
            const dot = target.closest('.tc-testimonial-carousel-dot') as HTMLElement | null
            if (dot && dot.dataset.idx != null) this._navigate(parseInt(dot.dataset.idx, 10))
        }
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (this._items.length < 2) return
        if (e.key === 'ArrowLeft') {
            e.preventDefault()
            this._navigate(this._active - 1)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            this._navigate(this._active + 1)
        }
    }

    private _onMouseEnter = (): void => {
        this._hovered = true
        this._syncTimer()
    }

    private _onMouseLeave = (): void => {
        this._hovered = false
        this._syncTimer()
    }

    private _onFocusIn = (): void => {
        this._focused = true
        this._syncTimer()
    }

    private _onFocusOut = (e: FocusEvent): void => {
        // Stay paused while focus is still inside the carousel
        if (e.relatedTarget instanceof Node && this.contains(e.relatedTarget)) return
        this._focused = false
        this._syncTimer()
    }

    private _onVisibility = (): void => {
        this._syncTimer()
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private _ariaLabel(): string {
        return this.getAttribute('aria-label') ?? 'Testimonials'
    }

    private _starsHtml(rating: number): string {
        const r = Math.max(0, Math.min(STAR_COUNT, Math.round(rating)))
        const stars: string[] = []
        for (let i = 0; i < STAR_COUNT; i++) {
            const filled = i < r ? ' tc-testimonial-carousel-star--filled' : ''
            stars.push(
                `<span class="tc-testimonial-carousel-star${filled}" aria-hidden="true">${starIconHtml}</span>`,
            )
        }
        return (
            `<div class="tc-testimonial-carousel-rating" role="img" aria-label="${r} out of ${STAR_COUNT} stars">` +
            stars.join('') +
            `</div>`
        )
    }

    private _slideHtml(item: Testimonial): string {
        const ratingHtml = typeof item.rating === 'number' ? this._starsHtml(item.rating) : ''

        const avatarHtml = item.avatarUrl
            ? `<img class="tc-testimonial-carousel-avatar" src="${esc(item.avatarUrl)}" alt="" loading="lazy" />`
            : ''

        const roleParts = [item.role, item.company].filter(Boolean) as string[]
        const roleHtml = roleParts.length
            ? `<span class="tc-testimonial-carousel-role">${esc(roleParts.join(', '))}</span>`
            : ''

        return (
            `<div class="tc-testimonial-carousel-slide">` +
            ratingHtml +
            `<blockquote class="tc-testimonial-carousel-quote">${esc(item.quote)}</blockquote>` +
            `<footer class="tc-testimonial-carousel-author">` +
            avatarHtml +
            `<span class="tc-testimonial-carousel-meta">` +
            `<span class="tc-testimonial-carousel-name">${esc(item.author)}</span>` +
            roleHtml +
            `</span>` +
            `</footer>` +
            `</div>`
        )
    }

    private _dotsHtml(): string {
        const dots = this._items
            .map((_, i) => {
                const active = i === this._active
                const activeClass = active ? ' tc-testimonial-carousel-dot--active' : ''
                const current = active ? ' aria-current="true"' : ''
                return (
                    `<button type="button" class="tc-testimonial-carousel-dot${activeClass}" ` +
                    `data-idx="${i}" aria-label="Go to testimonial ${i + 1}"${current}></button>`
                )
            })
            .join('')
        return `<div class="tc-testimonial-carousel-dots">${dots}</div>`
    }

    // Surgically swap only the active slide so focus on the controls is kept and
    // the CSS enter animation re-runs (replacing the node restarts the keyframes).
    //
    // The new node is hand-built (not run through patchHtml), so it has to be
    // markOwned'd into the same default region full renders use — otherwise the
    // next full render() (e.g. a new `items` assignment) doesn't recognise it as
    // its own, can't reconcile it, and leaves it orphaned in the DOM as a second,
    // stale `.tc-testimonial-carousel-slide` alongside the freshly patched one.
    private _renderSlide(): void {
        const slide = this.querySelector('.tc-testimonial-carousel-slide')
        const item = this._items[this._active]
        if (!slide || !item) return
        const tmp = document.createElement('div')
        tmp.innerHTML = this._slideHtml(item)
        const next = tmp.firstElementChild
        if (next) {
            markOwned(next, this)
            slide.replaceWith(next)
        }
    }

    private _updateDots(): void {
        const dots = this.querySelectorAll<HTMLElement>('.tc-testimonial-carousel-dot')
        dots.forEach((dot, i) => {
            const active = i === this._active
            dot.classList.toggle('tc-testimonial-carousel-dot--active', active)
            if (active) dot.setAttribute('aria-current', 'true')
            else dot.removeAttribute('aria-current')
        })
    }

    private render(): void {
        const items = this._items
        if (this._active >= items.length) this._active = 0
        const label = esc(this._ariaLabel())

        if (items.length === 0) {
            patchHtml(
                this,
                `<div class="tc-testimonial-carousel" role="region" ` +
                    `aria-roledescription="carousel" aria-label="${label}"></div>`,
            )
            return
        }

        const multi = items.length > 1
        const prevBtn = multi
            ? `<button type="button" class="tc-testimonial-carousel-prev" aria-label="Previous testimonial">${chevronLeftIcon}</button>`
            : ''
        const nextBtn = multi
            ? `<button type="button" class="tc-testimonial-carousel-next" aria-label="Next testimonial">${chevronRightIcon}</button>`
            : ''
        const dots = multi ? this._dotsHtml() : ''

        patchHtml(
            this,
            `<div class="tc-testimonial-carousel" role="region" aria-roledescription="carousel" aria-label="${label}">` +
                `<div class="tc-testimonial-carousel-track">` +
                prevBtn +
                this._slideHtml(items[this._active]) +
                nextBtn +
                `</div>` +
                dots +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TestimonialCarousel
    }
}

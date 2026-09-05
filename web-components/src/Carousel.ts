import { markOwned, patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { Carousel as BsCarousel } from './internal/Carousel'
import { setHostClass } from './internal/host-class'
import { chevronLeftIcon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-carousel'

// Three regions rather than one template. The indicators and the controls are
// OPTIONAL <div>s that sit either side of the track, and `compatible()` matches
// on tag name — so a single-region render walking [indicators?, inner] would
// happily re-dress the track into the indicators box the moment `indicators` was
// switched on, taking the slides inside it along. Naming the regions keeps each
// walk to its own nodes, and keeps the track's identity stable for good.
const INDICATORS = 'indicators'
const CONTROLS = 'controls'
/** The track and the slides in it — built by hand, never by a render. */
const SLIDES = 'slides'

let counter = 0

export class Carousel extends HTMLElement {
    private _bsCarousel: BsCarousel | null = null
    private _carouselId: string
    // One slide per consumer child, remembered by the child rather than by index:
    // react-dom reorders and removes children, and an index would follow the wrong
    // one across the change.
    private _slideFor = new WeakMap<Node, HTMLElement>()
    private _normalisePending = false
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['interval', 'controls', 'indicators', 'fade', 'ride', 'pause']
    }

    constructor() {
        super()
        this._carouselId = `tc-carousel-${++counter}`
    }

    connectedCallback(): void {
        if (!this.id) this.id = this._carouselId
        const first = !this._initialised
        this._initialised = true
        const slotContent = first ? Array.from(this.childNodes) : undefined
        this.render()
        this._adopt(slotContent)
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        this.render()
        this._adopt()
        this._initPlugin()
    }

    /**
     * A carousel is the awkward case of adoption: the consumer's children do not
     * share one container, they get one box EACH. So the route builds the slide
     * on demand and puts it where the child's own position says — see
     * adopt-children.ts.
     */
    private _adopt(nodes?: Node[]): void {
        adoptChildren(this, (node, before) => this._slotFor(node, before), nodes)
    }

    private _inner(): HTMLElement | null {
        return this.querySelector(':scope > .carousel-inner')
    }

    /** The track, created once and never re-rendered. */
    private _ensureInner(): HTMLElement {
        let inner = this._inner()
        if (!inner) {
            inner = document.createElement('div')
            inner.className = 'carousel-inner'
            markOwned(inner, this, SLIDES)
            this.appendChild(inner)
        }
        return inner
    }

    private _slotFor(node: Node, before: Node | null): Node | null {
        const inner = this._inner()
        if (!inner) return null
        // Whitespace between the consumer's elements is not a slide. Leaving it a
        // direct child of the host keeps it out of the count without touching it.
        if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) return null
        let slide = this._slideFor.get(node)
        if (!slide || !slide.isConnected) {
            slide = document.createElement('div')
            slide.className = 'carousel-item'
            // Its own region: the slides are built here, not by the render below,
            // and patchHtml has to step over them rather than sweep them up.
            markOwned(slide, this, SLIDES)
            this._slideFor.set(node, slide)
        }
        // No anchor means "last" — react-dom reorders a list by appending, so a
        // slide that is already in the track still has to move to the end.
        const anchorSlide = before ? this._slideFor.get(before) : undefined
        const anchor = anchorSlide && anchorSlide.parentNode === inner ? anchorSlide : null
        if (slide.parentNode !== inner || slide.nextSibling !== anchor)
            inner.insertBefore(slide, anchor)
        this._scheduleNormalise()
        return slide
    }

    /** Slides change one at a time as react-dom works through a render; the
     *  renumbering, the empty-slide sweep and the indicator rebuild are worth
     *  doing once, after it has finished. */
    private _scheduleNormalise(): void {
        if (this._normalisePending) return
        this._normalisePending = true
        queueMicrotask(() => {
            this._normalisePending = false
            if (this.isConnected) this._normalise()
        })
    }

    private _normalise(): void {
        const inner = this._inner()
        if (!inner) return
        const slides = Array.from(inner.children) as HTMLElement[]
        // A slide whose child react-dom removed is gone from the design.
        for (const slide of slides) if (!slide.firstChild) slide.remove()
        const live = slides.filter((s) => s.isConnected)
        live.forEach((slide, i) => slide.setAttribute('data-tc-slide', String(i)))
        if (live.length && !live.some((s) => s.classList.contains('active')))
            live[0].classList.add('active')
        // The indicator count is a function of the slide count, and the plugin
        // caches the slide list — both have to be rebuilt around the new set.
        this._teardown()
        this.render()
        this._initPlugin()
    }

    get interval(): number {
        const v = this.getAttribute('interval')
        return v !== null ? parseInt(v, 10) : 5000
    }
    set interval(v: number) {
        this.setAttribute('interval', String(v))
    }

    get controls(): boolean {
        return this.hasAttribute('controls')
    }
    set controls(v: boolean) {
        if (v) this.setAttribute('controls', '')
        else this.removeAttribute('controls')
    }

    get indicators(): boolean {
        return this.hasAttribute('indicators')
    }
    set indicators(v: boolean) {
        if (v) this.setAttribute('indicators', '')
        else this.removeAttribute('indicators')
    }

    get fade(): boolean {
        return this.hasAttribute('fade')
    }
    set fade(v: boolean) {
        if (v) this.setAttribute('fade', '')
        else this.removeAttribute('fade')
    }

    get ride(): string {
        return this.getAttribute('ride') ?? 'false'
    }
    set ride(v: string) {
        this.setAttribute('ride', v)
    }

    get pauseMode(): string {
        return this.getAttribute('pause') ?? 'hover'
    }
    set pauseMode(v: string) {
        this.setAttribute('pause', v)
    }

    next(): void {
        this._bsCarousel?.next()
    }

    prev(): void {
        this._bsCarousel?.prev()
    }

    to(i: number): void {
        this._bsCarousel?.to(i)
    }

    cycle(): void {
        this._bsCarousel?.cycle()
    }

    pause(): void {
        this._bsCarousel?.pause()
    }

    private _onSlide = (e: Event): void => {
        const ce = e as any
        this.dispatchEvent(
            new CustomEvent('tc-slide', {
                bubbles: true,
                composed: true,
                detail: { from: ce.from, to: ce.to, direction: ce.direction },
            }),
        )
    }

    private _onSlid = (e: Event): void => {
        const ce = e as any
        this.dispatchEvent(
            new CustomEvent('tc-slid', {
                bubbles: true,
                composed: true,
                detail: { from: ce.from, to: ce.to, direction: ce.direction },
            }),
        )
    }

    private render(): void {
        const id = this.id || this._carouselId

        setHostClass(this, `carousel slide${this.fade ? ' carousel-fade' : ''}`)

        const count = this._slideCount()
        const indicatorsHtml = this.indicators
            ? `<div class="carousel-indicators">${Array.from(
                  { length: count },
                  (_, i) =>
                      `<button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}"${i === 0 ? ' class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>`,
              ).join('')}</div>`
            : ''

        const controlsHtml = this.controls
            ? `<button class="carousel-control-prev" type="button" data-bs-target="#${id}" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true">${chevronLeftIcon}</span>
                <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#${id}" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true">${chevronRightIcon}</span>
                <span class="visually-hidden">Next</span>
            </button>`
            : ''

        // Indicators before the track, controls after it — each its own region, so
        // toggling either one cannot disturb the track between them.
        patchHtml(this, indicatorsHtml, { region: INDICATORS })
        this._ensureInner()
        patchHtml(this, controlsHtml, { region: CONTROLS, at: 'end' })
    }

    /** How many slides the chrome has to account for. Before the first render the
     *  consumer's children are still direct children of the host. */
    private _slideCount(): number {
        const inner = this._inner()
        if (inner) return inner.children.length
        return Array.from(this.childNodes).filter(
            (n) => !(n.nodeType === Node.TEXT_NODE && !(n.textContent ?? '').trim()),
        ).length
    }

    private _initPlugin(): void {
        const rideAttr = this.getAttribute('ride')
        const ride: 'carousel' | boolean =
            rideAttr === 'carousel' ? 'carousel' : rideAttr === 'true' ? true : false

        const pauseAttr = this.getAttribute('pause')
        const pause: 'hover' | false = pauseAttr === 'false' ? false : 'hover'

        this._bsCarousel = new BsCarousel(this, {
            interval: this.interval,
            ride,
            pause,
        })
        this.addEventListener('slide.bs.carousel', this._onSlide)
        this.addEventListener('slid.bs.carousel', this._onSlid)
    }

    private _teardown(): void {
        this.removeEventListener('slide.bs.carousel', this._onSlide)
        this.removeEventListener('slid.bs.carousel', this._onSlid)
        if (this._bsCarousel) {
            this._bsCarousel.dispose()
            this._bsCarousel = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Carousel
    }
}

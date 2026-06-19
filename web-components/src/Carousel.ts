import { Carousel as BsCarousel } from './internal/Carousel'
import { chevronLeftIcon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-carousel'

let counter = 0

export class Carousel extends HTMLElement {
    private _bsCarousel: BsCarousel | null = null
    private _carouselId: string
    private _slides: Node[] = []
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
        if (!this._initialised) {
            this._slides = Array.from(this.childNodes)
            this._initialised = true
        }
        this.render()
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
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

        this.className = `carousel slide${this.fade ? ' carousel-fade' : ''}`

        const indicatorsHtml = this.indicators
            ? `<div class="carousel-indicators">${this._slides
                  .map(
                      (_, i) =>
                          `<button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}"${i === 0 ? ' class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>`,
                  )
                  .join('')}</div>`
            : ''

        const slidesHtml = this._slides
            .map(
                (_, i) =>
                    `<div class="carousel-item${i === 0 ? ' active' : ''}" data-tc-slide="${i}"></div>`,
            )
            .join('')

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

        this.innerHTML = `${indicatorsHtml}<div class="carousel-inner">${slidesHtml}</div>${controlsHtml}`

        this._slides.forEach((node, i) => {
            const slot = this.querySelector(`[data-tc-slide="${i}"]`)
            if (slot) slot.appendChild(node)
        })
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

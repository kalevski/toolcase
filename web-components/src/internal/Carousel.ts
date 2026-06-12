import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Carousel plugin: next/prev/to/cycle/pause,
// interval cycling, pause-on-hover, indicator + control button wiring
// (data-bs-slide / data-bs-slide-to) and the Bootstrap slide class protocol
// (.carousel-item-next/-prev + .carousel-item-start/-end) with
// slide/slid.bs.carousel events carrying { from, to, direction }.

export interface CarouselOptions {
    interval?: number
    ride?: 'carousel' | boolean
    pause?: 'hover' | false
}

export class Carousel {
    private _element: HTMLElement
    private _interval: number
    private _ride: 'carousel' | boolean
    private _pauseOnHover: boolean
    private _timer: number | null = null
    private _sliding = false
    private _paused = false

    constructor(element: HTMLElement, options: CarouselOptions = {}) {
        this._element = element
        this._interval = options.interval ?? 5000
        this._ride = options.ride ?? false
        this._pauseOnHover = options.pause !== false

        element.addEventListener('click', this._onControlClick)
        if (this._pauseOnHover) {
            element.addEventListener('mouseenter', this._onMouseEnter)
            element.addEventListener('mouseleave', this._onMouseLeave)
        }
        if (this._ride === 'carousel') this.cycle()
    }

    next(): void {
        this._slide('next')
    }

    prev(): void {
        this._slide('prev')
    }

    to(index: number): void {
        const items = this._items()
        if (index < 0 || index >= items.length) return
        const activeIndex = this._activeIndex()
        if (index === activeIndex) return
        this._slide(index > activeIndex ? 'next' : 'prev', items[index])
    }

    cycle(): void {
        this._paused = false
        this._clearTimer()
        if (this._interval <= 0) return
        this._timer = window.setInterval(() => {
            if (!this._paused && !this._sliding) this.next()
        }, this._interval)
    }

    pause(): void {
        this._paused = true
        this._clearTimer()
    }

    dispose(): void {
        this._clearTimer()
        this._element.removeEventListener('click', this._onControlClick)
        this._element.removeEventListener('mouseenter', this._onMouseEnter)
        this._element.removeEventListener('mouseleave', this._onMouseLeave)
    }

    private _clearTimer(): void {
        if (this._timer !== null) {
            window.clearInterval(this._timer)
            this._timer = null
        }
    }

    private _items(): HTMLElement[] {
        return Array.from(this._element.querySelectorAll<HTMLElement>('.carousel-item'))
    }

    private _activeIndex(): number {
        return this._items().findIndex((item) => item.classList.contains('active'))
    }

    private _slide(direction: 'next' | 'prev', explicitTarget?: HTMLElement): void {
        if (this._sliding) return
        const items = this._items()
        if (items.length < 2) return

        const activeIndex = this._activeIndex()
        const active = items[activeIndex]
        const targetIndex = explicitTarget
            ? items.indexOf(explicitTarget)
            : (activeIndex + (direction === 'next' ? 1 : -1) + items.length) % items.length
        const target = items[targetIndex]
        if (!active || !target || target === active) return

        const eventDirection = direction === 'next' ? 'left' : 'right'
        const slideEvent = triggerEvent(this._element, 'slide.bs.carousel', {
            from: activeIndex,
            to: targetIndex,
            direction: eventDirection,
        })
        if (slideEvent.defaultPrevented) return

        this._sliding = true
        const orderClass = direction === 'next' ? 'carousel-item-next' : 'carousel-item-prev'
        const moveClass = direction === 'next' ? 'carousel-item-start' : 'carousel-item-end'

        target.classList.add(orderClass)
        reflow(target)
        active.classList.add(moveClass)
        target.classList.add(moveClass)
        this._updateIndicators(targetIndex)

        executeAfterTransition(active, () => {
            target.classList.remove(orderClass, moveClass)
            target.classList.add('active')
            active.classList.remove('active', moveClass)
            this._sliding = false
            triggerEvent(this._element, 'slid.bs.carousel', {
                from: activeIndex,
                to: targetIndex,
                direction: eventDirection,
            })
        })

        if (this._ride === true && this._timer === null) this.cycle()
    }

    private _updateIndicators(targetIndex: number): void {
        const indicators = this._element.querySelectorAll<HTMLElement>(
            '.carousel-indicators [data-bs-slide-to]',
        )
        indicators.forEach((indicator) => {
            const isTarget = indicator.getAttribute('data-bs-slide-to') === String(targetIndex)
            indicator.classList.toggle('active', isTarget)
            if (isTarget) indicator.setAttribute('aria-current', 'true')
            else indicator.removeAttribute('aria-current')
        })
    }

    private _onControlClick = (event: Event): void => {
        const target = event.target as Element
        const control = target.closest<HTMLElement>('[data-bs-slide], [data-bs-slide-to]')
        if (!control || !this._element.contains(control)) return
        event.preventDefault()

        const slideTo = control.getAttribute('data-bs-slide-to')
        if (slideTo !== null) {
            this.to(parseInt(slideTo, 10))
            return
        }
        const slide = control.getAttribute('data-bs-slide')
        if (slide === 'prev') this.prev()
        else if (slide === 'next') this.next()
    }

    private _onMouseEnter = (): void => {
        this._paused = true
    }

    private _onMouseLeave = (): void => {
        this._paused = false
    }
}

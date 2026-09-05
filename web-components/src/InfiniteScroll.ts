import { patchHtml } from './internal/patch-html'
import { rootMargin as cssRootMargin } from './internal/safe-dom'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-infinite-scroll'

export class InfiniteScroll extends HTMLElement {
    private _initialised = false
    private _observer: IntersectionObserver | null = null
    private _intersecting = false
    private _fired = false

    onLoadMore: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['has-more', 'loading', 'threshold', 'root-margin']
    }

    get hasMore(): boolean {
        return this.hasAttribute('has-more')
    }
    set hasMore(v: boolean) {
        if (v) this.setAttribute('has-more', '')
        else this.removeAttribute('has-more')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get threshold(): number {
        const raw = parseFloat(this.getAttribute('threshold') ?? '0')
        return isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), 1)
    }
    set threshold(v: number) {
        this.setAttribute('threshold', String(v))
    }

    /** Coerced on read, not on write: a margin without units — `100` where the
     *  author meant `100px` — makes the IntersectionObserver constructor throw,
     *  and it would throw from inside connectedCallback where no consumer can
     *  catch it. An unusable value simply means "no margin". */
    get rootMargin(): string {
        return cssRootMargin(this.getAttribute('root-margin'), '0px')
    }
    set rootMargin(v: string) {
        setAttr(this, 'root-margin', v)
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._initialised = true
            this.render()
        }
        this._buildObserver()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        this.render()

        if (name === 'loading' && next === null) {
            // loading ended — reset fired so we can fire again if sentinel is in view
            this._fired = false
        }

        if (name === 'has-more' && next !== null) {
            // has-more restored — reset fired
            this._fired = false
        }

        // Always rebuild the observer: render() replaced the sentinel DOM element.
        this._buildObserver()
    }

    disconnectedCallback(): void {
        this._observer?.disconnect()
        this._observer = null
    }

    private _buildObserver(): void {
        this._observer?.disconnect()
        this._observer = null

        const sentinel = this.querySelector('.tc-infinite-scroll-sentinel')
        if (!sentinel || !this.hasMore) return

        this._observer = new IntersectionObserver(
            (entries) => {
                this._intersecting = entries[0].isIntersecting
                this._tryFire()
            },
            {
                threshold: this.threshold,
                rootMargin: this.rootMargin,
            },
        )

        this._observer.observe(sentinel)
    }

    private _tryFire(): void {
        if (this._intersecting && this.hasMore && !this.loading && !this._fired) {
            this._fired = true
            this.dispatchEvent(
                new CustomEvent('tc-load-more', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }),
            )
            if (typeof this.onLoadMore === 'function') this.onLoadMore()
        }
    }

    private render(): void {
        const hasMore = this.hasMore
        const loading = this.loading
        const hasCustomLoading = this.querySelector(':scope > [data-slot="loading"]') != null
        const hasCustomEnd = this.querySelector(':scope > [data-slot="end"]') != null

        const defaultSpinner = hasCustomLoading
            ? ''
            : `<div class="spinner-border spinner-border-sm tc-infinite-scroll__spinner" aria-hidden="true"></div>` +
              `<span class="visually-hidden">Loading…</span>`

        const defaultEnd = hasCustomEnd
            ? ''
            : `<span class="tc-infinite-scroll__end-label">End</span>`

        const loadingVisible = loading ? ' tc-infinite-scroll-loading--visible' : ''
        const endVisible = !hasMore ? ' tc-infinite-scroll-end--visible' : ''

        patchHtml(
            this,
            `<div class="tc-infinite-scroll-sentinel" aria-hidden="true"></div>` +
                `<div class="tc-infinite-scroll-loading${loadingVisible}" role="status" aria-live="polite">` +
                defaultSpinner +
                `</div>` +
                `<div class="tc-infinite-scroll-end${endVisible}">` +
                defaultEnd +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InfiniteScroll
    }
}

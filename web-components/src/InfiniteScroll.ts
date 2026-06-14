const TAG_NAME = 'tc-infinite-scroll'

export class InfiniteScroll extends HTMLElement {

    private _initialised = false
    private _observer: IntersectionObserver | null = null
    private _intersecting = false
    private _fired = false

    private _contentNodes: Node[] = []
    private _loadingNodes: Node[] = []
    private _endNodes: Node[] = []

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

    get rootMargin(): string {
        return this.getAttribute('root-margin') ?? '0px'
    }
    set rootMargin(v: string) {
        this.setAttribute('root-margin', v)
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const all = Array.from(this.childNodes)
            this._contentNodes = all.filter(n => {
                if (!(n instanceof Element)) return true
                const slot = n.getAttribute('data-slot')
                return slot !== 'loading' && slot !== 'end'
            })
            this._loadingNodes = all.filter(
                n => n instanceof Element && (n as Element).getAttribute('data-slot') === 'loading'
            )
            this._endNodes = all.filter(
                n => n instanceof Element && (n as Element).getAttribute('data-slot') === 'end'
            )
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
        this._buildObserver()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture slot content from within their containers
        const contentEl = this.querySelector('.tc-infinite-scroll-content')
        const loadingEl = this.querySelector('.tc-infinite-scroll-loading')
        const endEl = this.querySelector('.tc-infinite-scroll-end')

        if (contentEl) this._contentNodes = Array.from(contentEl.childNodes)
        if (loadingEl) {
            const custom = Array.from(loadingEl.querySelectorAll('[data-slot="loading"]'))
            if (custom.length > 0) this._loadingNodes = custom
        }
        if (endEl) {
            const custom = Array.from(endEl.querySelectorAll('[data-slot="end"]'))
            if (custom.length > 0) this._endNodes = custom
        }

        this.render()
        this._distributeSlots()

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

    private _distributeSlots(): void {
        const contentEl = this.querySelector('.tc-infinite-scroll-content')
        const loadingEl = this.querySelector('.tc-infinite-scroll-loading')
        const endEl = this.querySelector('.tc-infinite-scroll-end')
        if (contentEl) this._contentNodes.forEach(n => contentEl.appendChild(n))
        if (loadingEl) this._loadingNodes.forEach(n => loadingEl.appendChild(n))
        if (endEl) this._endNodes.forEach(n => endEl.appendChild(n))
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
            }
        )

        this._observer.observe(sentinel)
    }

    private _tryFire(): void {
        if (this._intersecting && this.hasMore && !this.loading && !this._fired) {
            this._fired = true
            this.dispatchEvent(new CustomEvent('tc-load-more', {
                bubbles: true,
                composed: true,
                detail: {},
            }))
            if (typeof this.onLoadMore === 'function') this.onLoadMore()
        }
    }

    private render(): void {
        const hasMore = this.hasMore
        const loading = this.loading
        const hasCustomLoading = this._loadingNodes.length > 0
        const hasCustomEnd = this._endNodes.length > 0

        const defaultSpinner = hasCustomLoading ? '' :
            `<div class="spinner-border spinner-border-sm tc-infinite-scroll__spinner" aria-hidden="true"></div>` +
            `<span class="visually-hidden">Loading…</span>`

        const defaultEnd = hasCustomEnd ? '' :
            `<span class="tc-infinite-scroll__end-label">End</span>`

        const loadingVisible = loading ? ' tc-infinite-scroll-loading--visible' : ''
        const endVisible = !hasMore ? ' tc-infinite-scroll-end--visible' : ''

        this.innerHTML =
            `<div class="tc-infinite-scroll-content"></div>` +
            `<div class="tc-infinite-scroll-sentinel" aria-hidden="true"></div>` +
            `<div class="tc-infinite-scroll-loading${loadingVisible}" role="status" aria-live="polite">` +
            defaultSpinner +
            `</div>` +
            `<div class="tc-infinite-scroll-end${endVisible}">` +
            defaultEnd +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InfiniteScroll
    }
}

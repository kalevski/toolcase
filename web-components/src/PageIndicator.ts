const TAG_NAME = 'tc-page-indicator'

export class PageIndicator extends HTMLElement {
    private _initialised = false
    private _clickHandler = (e: Event) => this._onClick(e)
    private _keydownHandler = (e: KeyboardEvent) => this._onKeydown(e)

    onSelect: ((index: number) => void) | null = null

    static get observedAttributes(): string[] {
        return ['count', 'index', 'size', 'gap', 'color', 'active-color']
    }

    connectedCallback(): void {
        this.addEventListener('click', this._clickHandler)
        this.addEventListener('keydown', this._keydownHandler)
        if (!this._initialised) {
            this.setAttribute('role', 'group')
            if (!this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label', 'Page navigation')
            }
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._clickHandler)
        this.removeEventListener('keydown', this._keydownHandler)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get count(): number {
        const raw = this.getAttribute('count')
        if (raw == null) return 0
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    set count(value: number) {
        this.setAttribute('count', String(value))
    }

    get index(): number {
        const raw = this.getAttribute('index')
        if (raw == null) return 0
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    set index(value: number) {
        this.setAttribute('index', String(value))
    }

    get size(): number | null {
        const value = this.getAttribute('size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    get gap(): string {
        return this.getAttribute('gap') ?? ''
    }
    set gap(value: string) {
        if (value) this.setAttribute('gap', value)
        else this.removeAttribute('gap')
    }

    get color(): string {
        return this.getAttribute('color') ?? ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get activeColor(): string {
        return this.getAttribute('active-color') ?? ''
    }
    set activeColor(value: string) {
        if (value) this.setAttribute('active-color', value)
        else this.removeAttribute('active-color')
    }

    private _onClick(e: Event): void {
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-pi]')
        if (!target) return
        const idx = parseInt(target.dataset.pi ?? '', 10)
        if (Number.isNaN(idx)) return
        this._select(idx)
    }

    private _onKeydown(e: KeyboardEvent): void {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-pi]')
        if (!target) return
        const idx = parseInt(target.dataset.pi ?? '', 10)
        if (Number.isNaN(idx)) return
        e.preventDefault()
        this._select(idx)
    }

    private _select(index: number): void {
        if (index === this.index) return
        this.index = index
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { index },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(index)
    }

    private render(): void {
        const size = this.size
        if (size != null) this.style.setProperty('--bs-page-indicator-size', `${size}px`)
        else this.style.removeProperty('--bs-page-indicator-size')

        const gap = this.getAttribute('gap')
        if (gap) this.style.setProperty('--bs-page-indicator-gap', gap)
        else this.style.removeProperty('--bs-page-indicator-gap')

        const color = this.getAttribute('color')
        if (color) this.style.setProperty('--bs-page-indicator-color', color)
        else this.style.removeProperty('--bs-page-indicator-color')

        const activeColor = this.getAttribute('active-color')
        if (activeColor) this.style.setProperty('--bs-page-indicator-active-color', activeColor)
        else this.style.removeProperty('--bs-page-indicator-active-color')

        const count = this.count
        const active = this.index
        const dots: string[] = []
        for (let i = 0; i < count; i++) {
            const isActive = i === active
            const cls = isActive
                ? 'tc-page-indicator-dot tc-page-indicator-dot--active'
                : 'tc-page-indicator-dot'
            dots.push(
                `<button type="button" class="${cls}" data-pi="${i}" aria-label="Page ${i + 1}" aria-current="${isActive ? 'page' : 'false'}"></button>`,
            )
        }
        this.innerHTML = dots.join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PageIndicator
    }
}

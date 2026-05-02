const TAG_NAME = 'gc-page-indicator'

export interface PageIndicatorEventMap {
    select: CustomEvent<{ index: number }>
}

export class PageIndicator extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['count', 'index', 'size', 'gap', 'color', 'active-color']
    }

    private root: ShadowRoot
    private clickHandler = (event: Event) => this.handleClick(event)
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.addEventListener('click', this.clickHandler)
        this.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.clickHandler)
        this.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
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
        return Number.isNaN(parsed) ? 0 : parsed
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
        return this.getAttribute('gap') || ''
    }
    set gap(value: string) {
        if (value) this.setAttribute('gap', value)
        else this.removeAttribute('gap')
    }

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get activeColor(): string {
        return this.getAttribute('active-color') || ''
    }
    set activeColor(value: string) {
        if (value) this.setAttribute('active-color', value)
        else this.removeAttribute('active-color')
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private handleClick(event: Event): void {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-page-index]')
        if (!target) return
        const idx = parseInt(target.dataset.pageIndex || '', 10)
        if (Number.isNaN(idx)) return
        this.selectIndex(idx)
    }

    private handleKey(event: KeyboardEvent): void {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-page-index]')
        if (!target) return
        const idx = parseInt(target.dataset.pageIndex || '', 10)
        if (Number.isNaN(idx)) return
        event.preventDefault()
        this.selectIndex(idx)
    }

    private selectIndex(index: number): void {
        if (index === this.index) return
        this.index = index
        this.emit('select', { index })
    }

    private render(): void {
        const size = this.size
        if (size != null) this.style.setProperty('--gc-page-indicator-size', `${size}px`)
        else this.style.removeProperty('--gc-page-indicator-size')

        const gap = this.gap
        if (gap) this.style.setProperty('--gc-page-indicator-gap', gap)
        else this.style.removeProperty('--gc-page-indicator-gap')

        const color = this.color
        if (color) this.style.setProperty('--gc-page-indicator-color', color)
        else this.style.removeProperty('--gc-page-indicator-color')

        const activeColor = this.activeColor
        if (activeColor) this.style.setProperty('--gc-page-indicator-active-color', activeColor)
        else this.style.removeProperty('--gc-page-indicator-active-color')

        const count = this.count
        const active = this.index
        const dots: string[] = []
        for (let i = 0; i < count; i++) {
            const isActive = i === active
            const cls = isActive ? 'gc-page-indicator-dot is-active' : 'gc-page-indicator-dot'
            dots.push(
                `<button type="button" class="${cls}" data-page-index="${i}" aria-label="Page ${i + 1}" aria-current="${isActive ? 'page' : 'false'}"></button>`
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

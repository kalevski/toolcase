import type { CreditsSection } from './CreditsList'

const TAG_NAME = 'gc-credits-scroll'

export interface CreditsScrollEventMap {
    complete: CustomEvent<void>
}

export class CreditsScroll extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['speed', 'scroll-title']
    }

    private _sections: CreditsSection[] = []
    private _playing = true
    private _offset = 0
    private rafId: number | null = null
    private lastTs = 0
    private clickHandler = () => this.togglePlay()
    private keyHandler = (event: KeyboardEvent): void => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        this.togglePlay()
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Credits — Space or Enter to pause/play')
        this.setAttribute('aria-pressed', String(!this._playing))
        this.addEventListener('click', this.clickHandler)
        this.addEventListener('keydown', this.keyHandler)
        this.render()
        this.startLoop()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.clickHandler)
        this.removeEventListener('keydown', this.keyHandler)
        this.stopLoop()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get speed(): number {
        const raw = this.getAttribute('speed')
        if (raw == null) return 30
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
    }
    set speed(v: number) {
        this.setAttribute('speed', String(v))
    }

    get scrollTitle(): string {
        return this.getAttribute('scroll-title') ?? ''
    }
    set scrollTitle(v: string) {
        if (v) this.setAttribute('scroll-title', v)
        else this.removeAttribute('scroll-title')
    }

    get sections(): CreditsSection[] {
        return this._sections.slice()
    }
    set sections(value: CreditsSection[]) {
        this._sections = Array.isArray(value) ? value.slice() : []
        this._offset = 0
        if (this.isConnected) {
            this.render()
            this.startLoop()
        }
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private togglePlay(): void {
        this._playing = !this._playing
        this.setAttribute('aria-pressed', String(!this._playing))
        const indicator = this.querySelector('.gc-credits-scroll-indicator') as HTMLElement | null
        if (indicator) indicator.textContent = this._playing ? '' : '⏸'
        if (this._playing) this.startLoop()
    }

    private stopLoop(): void {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
    }

    private startLoop(): void {
        this.stopLoop()
        this.lastTs = 0
        const tick = (ts: number) => {
            if (!this._playing) {
                this.rafId = null
                return
            }
            if (this.lastTs === 0) this.lastTs = ts
            const dt = (ts - this.lastTs) / 1000
            this.lastTs = ts
            this._offset += dt * this.speed
            const inner = this.querySelector('.gc-credits-scroll-track') as HTMLElement | null
            const viewport = this.querySelector('.gc-credits-scroll-viewport') as HTMLElement | null
            if (inner && viewport) {
                const max = inner.scrollHeight
                if (this._offset >= max) {
                    this._offset = 0
                    this._playing = false
                    this.emit('complete')
                    this.rafId = null
                    return
                }
                inner.style.transform = `translateY(${(-this._offset).toFixed(2)}px)`
            }
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
    }

    private render(): void {
        const titleMarkup = this.scrollTitle
            ? `<gc-title class="gc-credits-scroll-title">${this.escape(this.scrollTitle)}</gc-title>`
            : ''
        const sectionsMarkup = this._sections.map((s) => {
            const names = (s.names || []).map((n) => `<div class="gc-credits-scroll-name">${this.escape(n)}</div>`).join('')
            return `<div class="gc-credits-scroll-section">
                <div class="gc-credits-scroll-role">${this.escape(s.role)}</div>
                <div class="gc-credits-scroll-names">${names}</div>
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-credits-scroll-viewport">
                <div class="gc-credits-scroll-track">
                    ${titleMarkup}
                    ${sectionsMarkup}
                </div>
            </div>
            <span class="gc-credits-scroll-indicator"></span>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CreditsScroll
    }
}

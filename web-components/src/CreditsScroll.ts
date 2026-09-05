import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { Pause } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-credits-scroll'

const DEFAULT_SPEED = 30

const pauseIconHtml = icon(Pause)

export interface CreditsScrollSection {
    role: string
    names: string[]
}

export class CreditsScroll extends HTMLElement {
    private _initialised = false
    private _sections: CreditsScrollSection[] = []
    private _playing = true
    private _offset = 0
    private _rafId: number | null = null
    private _lastTs = 0

    // Optional callback fired alongside the tc-complete event.
    onComplete: (() => void) | null = null

    private _clickHandler = (): void => this.togglePlay()
    private _keyHandler = (event: KeyboardEvent): void => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        this.togglePlay()
    }

    static get observedAttributes(): string[] {
        return ['speed', 'scroll-title']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        if (!this.hasAttribute('aria-label')) {
            this.setAttribute('aria-label', 'Credits — Space or Enter to pause or play')
        }
        this.setAttribute('aria-pressed', String(!this._playing))
        this.addEventListener('click', this._clickHandler)
        this.addEventListener('keydown', this._keyHandler)
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.startLoop()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._clickHandler)
        this.removeEventListener('keydown', this._keyHandler)
        this.stopLoop()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get speed(): number {
        const raw = this.getAttribute('speed')
        if (raw == null) return DEFAULT_SPEED
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPEED
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

    get sections(): CreditsScrollSection[] {
        return this._sections.slice()
    }
    set sections(value: CreditsScrollSection[]) {
        this._sections = Array.isArray(value) ? value.slice() : []
        this._offset = 0
        if (this._initialised) {
            this.render()
            this.startLoop()
        }
    }

    get playing(): boolean {
        return this._playing
    }

    private _prefersReducedMotion(): boolean {
        return (
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
    }

    private togglePlay(): void {
        this._playing = !this._playing
        this.setAttribute('aria-pressed', String(!this._playing))
        this.classList.toggle('tc-credits-scroll--paused', !this._playing)
        if (this._playing) this.startLoop()
        else this.stopLoop()
    }

    private stopLoop(): void {
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId)
            this._rafId = null
        }
    }

    private startLoop(): void {
        this.stopLoop()
        // Under reduced motion the viewport is a static scrollable region; no
        // auto-scroll is driven.
        if (this._prefersReducedMotion()) return
        this._lastTs = 0
        const tick = (ts: number): void => {
            if (!this._playing) {
                this._rafId = null
                return
            }
            if (this._lastTs === 0) this._lastTs = ts
            const dt = (ts - this._lastTs) / 1000
            this._lastTs = ts
            this._offset += dt * this.speed
            const track = this.querySelector<HTMLElement>('.tc-credits-scroll-track')
            const viewport = this.querySelector<HTMLElement>('.tc-credits-scroll-viewport')
            if (track && viewport) {
                const max = track.scrollHeight
                if (this._offset >= max) {
                    this._offset = 0
                    this._playing = false
                    this.setAttribute('aria-pressed', 'true')
                    this.classList.add('tc-credits-scroll--paused')
                    this.emitComplete()
                    this._rafId = null
                    return
                }
                track.style.transform = `translateY(${(-this._offset).toFixed(2)}px)`
            }
            this._rafId = requestAnimationFrame(tick)
        }
        this._rafId = requestAnimationFrame(tick)
    }

    private emitComplete(): void {
        this.dispatchEvent(
            new CustomEvent('tc-complete', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onComplete === 'function') this.onComplete()
    }

    private render(): void {
        const titleMarkup = this.scrollTitle
            ? `<div class="tc-credits-scroll-title">${esc(this.scrollTitle)}</div>`
            : ''
        const sectionsMarkup = this._sections
            .map((s) => {
                const names = (s.names || [])
                    .map((n) => `<div class="tc-credits-scroll-name">${esc(n)}</div>`)
                    .join('')
                return `<div class="tc-credits-scroll-section">
                <div class="tc-credits-scroll-role">${esc(s.role)}</div>
                <div class="tc-credits-scroll-names">${names}</div>
            </div>`
            })
            .join('')

        // The transform is also written imperatively every animation frame (see
        // `startLoop`'s `tick`), onto this same track element. patchHtml reconciles
        // attributes against this template, so if the template omitted `style` it
        // would strip that imperative transform on every re-render triggered by an
        // unrelated attribute change (e.g. `speed`) or by `scrollTitle` while
        // paused — snapping the credits back to the top without resetting
        // `_offset`. Embedding the current offset here keeps the two in sync.
        patchHtml(
            this,
            `
            <div class="tc-credits-scroll-viewport">
                <div class="tc-credits-scroll-track" style="transform: translateY(${(-this._offset).toFixed(2)}px)">
                    ${titleMarkup}
                    ${sectionsMarkup}
                </div>
            </div>
            <span class="tc-credits-scroll-indicator" aria-hidden="true">${pauseIconHtml}</span>
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CreditsScroll
    }
}

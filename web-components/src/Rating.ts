import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-rating'

export type RatingSize = 'small' | 'default' | 'large'
const SIZES: RatingSize[] = ['small', 'default', 'large']

// Star rating: a single role="slider" container holding `count` layered icon
// glyphs (an empty bg layer + a clipped fill overlay so half-fill can show).
// `value` is the controlled selection; the React `onChange` becomes both a
// `tc-change` CustomEvent and an optional `onChange` callback property.
export class Rating extends HTMLElement {
    private _initialised = false

    onChange: ((value: number) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'count', 'allow-half', 'read-only', 'size', 'icon']
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
        if (name === 'value') {
            this._patchValue()
            return
        }
        this.render()
    }

    // ── Props ───────────────────────────────────────────────────────────────────

    get value(): number {
        const raw = parseFloat(this.getAttribute('value') ?? '0')
        if (isNaN(raw)) return 0
        return Math.min(Math.max(raw, 0), this.count)
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get count(): number {
        const raw = parseInt(this.getAttribute('count') ?? '5', 10)
        return isNaN(raw) || raw < 1 ? 5 : raw
    }
    set count(v: number) {
        this.setAttribute('count', String(v))
    }

    get allowHalf(): boolean {
        return this.hasAttribute('allow-half')
    }
    set allowHalf(v: boolean) {
        if (v) this.setAttribute('allow-half', '')
        else this.removeAttribute('allow-half')
    }

    get readOnly(): boolean {
        return this.hasAttribute('read-only')
    }
    set readOnly(v: boolean) {
        if (v) this.setAttribute('read-only', '')
        else this.removeAttribute('read-only')
    }

    get size(): RatingSize {
        const raw = (this.getAttribute('size') ?? 'default') as RatingSize
        return SIZES.includes(raw) ? raw : 'default'
    }
    set size(v: RatingSize) {
        setAttr(this, 'size', v)
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'star'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    // ── Painting ────────────────────────────────────────────────────────────────

    private _fillFor(displayValue: number, starIndex: number): 'full' | 'half' | 'empty' {
        if (displayValue >= starIndex) return 'full'
        if (this.allowHalf && displayValue >= starIndex - 0.5) return 'half'
        return 'empty'
    }

    // Surgically repaint every star to `displayValue` without rewriting innerHTML.
    private _paintStars(displayValue: number, hovering: boolean): void {
        const stars = this.querySelectorAll<HTMLElement>('.tc-rating-star')
        stars.forEach((star, i) => {
            const fill = this._fillFor(displayValue, i + 1)
            star.classList.remove(
                'tc-rating-star--full',
                'tc-rating-star--half',
                'tc-rating-star--empty',
                'tc-rating-star--hover',
            )
            star.classList.add(`tc-rating-star--${fill}`)
            if (hovering && fill !== 'empty') star.classList.add('tc-rating-star--hover')
        })
    }

    // Reflect a `value` change (paint + aria) without a structural re-render.
    private _patchValue(): void {
        const slider = this.querySelector<HTMLElement>('.tc-rating')
        if (slider) slider.setAttribute('aria-valuenow', String(this.value))
        this._paintStars(this.value, false)
    }

    private _hoverValueFromEvent(star: HTMLElement, clientX: number, starIndex: number): number {
        if (!this.allowHalf) return starIndex
        const rect = star.getBoundingClientRect()
        return clientX - rect.left < rect.width / 2 ? starIndex - 0.5 : starIndex
    }

    private _commit(next: number): void {
        const value = Math.min(Math.max(next, 0), this.count)
        this.setAttribute('value', String(value))
        this._patchValue()
        this._fireChange(value)
    }

    private _fireChange(value: number): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    // ── Handlers (delegated on the host, which survives re-renders) ──────────────

    private _onMouseMove = (e: MouseEvent): void => {
        if (this.readOnly) return
        const star = (e.target as Element).closest<HTMLElement>('.tc-rating-star')
        if (!star) return
        const idx = parseInt(star.dataset.index ?? '0', 10)
        this._paintStars(this._hoverValueFromEvent(star, e.clientX, idx), true)
    }

    private _onMouseLeave = (): void => {
        if (this.readOnly) return
        this._paintStars(this.value, false)
    }

    private _onClick = (e: MouseEvent): void => {
        if (this.readOnly) return
        const star = (e.target as Element).closest<HTMLElement>('.tc-rating-star')
        if (!star) return
        const idx = parseInt(star.dataset.index ?? '0', 10)
        this._commit(this._hoverValueFromEvent(star, e.clientX, idx))
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.readOnly) return
        const step = this.allowHalf ? 0.5 : 1
        const count = this.count
        let next = this.value
        let changed = true
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                next = Math.min(this.value + step, count)
                break
            case 'ArrowLeft':
            case 'ArrowDown':
                next = Math.max(this.value - step, 0)
                break
            case 'Home':
                next = 0
                break
            case 'End':
                next = count
                break
            default:
                changed = false
        }
        if (changed) {
            e.preventDefault()
            this._commit(next)
        }
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('mousemove', this._onMouseMove)
        this.addEventListener('mouseleave', this._onMouseLeave)
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeyDown)
    }

    private _detachHandlers(): void {
        this.removeEventListener('mousemove', this._onMouseMove)
        this.removeEventListener('mouseleave', this._onMouseLeave)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeyDown)
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    private render(): void {
        const count = this.count
        const value = this.value
        const size = this.size
        const readOnly = this.readOnly
        const glyph = lucideByName(this.icon) || lucideByName('star')

        const tag = readOnly ? 'span' : 'button'
        const stars: string[] = []
        for (let i = 1; i <= count; i++) {
            const fill = this._fillFor(value, i)
            const attrs = readOnly
                ? `class="tc-rating-star tc-rating-star--${fill}" data-index="${i}" aria-hidden="true"`
                : `class="tc-rating-star tc-rating-star--${fill}" type="button" tabindex="-1" data-index="${i}" aria-hidden="true"`
            stars.push(
                `<${tag} ${attrs}>` +
                    `<span class="tc-rating-star-bg">${glyph}</span>` +
                    `<span class="tc-rating-star-fill">${glyph}</span>` +
                    `</${tag}>`,
            )
        }

        const sliderAttrs = [
            `class="tc-rating tc-rating--${size}${readOnly ? ' tc-rating--readonly' : ''}"`,
            `role="slider"`,
            `aria-label="Rating"`,
            `aria-valuemin="0"`,
            `aria-valuemax="${count}"`,
            `aria-valuenow="${value}"`,
            readOnly ? `aria-readonly="true"` : `tabindex="0"`,
        ].join(' ')

        patchHtml(this, `<div ${sliderAttrs}>${stars.join('')}</div>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Rating
    }
}

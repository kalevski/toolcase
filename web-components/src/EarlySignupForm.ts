import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-early-signup-form'

export type EarlySignupFormVariant = 'dark' | 'light'
const VARIANTS: EarlySignupFormVariant[] = ['dark', 'light']

let _idCounter = 0

// Pre-compute icons once at module load time
const checkIconHtml = lucideByName('check')
const checkCircleIconHtml = lucideByName('check-circle')
const arrowRightIconHtml = lucideByName('arrow-right')

export class EarlySignupForm extends HTMLElement {
    private _initialised = false
    private _benefits: string[] = []
    private _submitted = false
    private _email = ''
    private _error = ''
    private _idPrefix: string

    /** Optional JS callback fired alongside the tc-submit CustomEvent. */
    onSubmit: ((email: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-esf-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return [
            // NOTE: 'title' is listed so attributeChangedCallback fires on changes.
            // No getter/setter is defined — HTMLElement already reflects title natively.
            'title',
            'subtitle',
            'eyebrow',
            'helper-text',
            'cta-label',
            'field-label',
            'stat',
            'placeholder',
            'success-title',
            'success-message',
            'variant',
            'loading',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('input', this._onInput)
        this.addEventListener('click', this._onClick)
        this.addEventListener('submit', this._onFormSubmit)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('submit', this._onFormSubmit)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const emailFocused = document.activeElement === this.querySelector('input[name="email"]')
        this.render()
        if (emailFocused) {
            this.querySelector<HTMLInputElement>('input[name="email"]')?.focus()
        }
    }

    // NOTE: `title` collides with the native HTMLElement.title property.
    // Read via getAttribute('title') in render(); no getter/setter defined.

    get subtitle(): string | null {
        return this.getAttribute('subtitle')
    }
    set subtitle(v: string | null) {
        if (v != null) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    get eyebrow(): string | null {
        return this.getAttribute('eyebrow')
    }
    set eyebrow(v: string | null) {
        if (v != null) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get helperText(): string | null {
        return this.getAttribute('helper-text')
    }
    set helperText(v: string | null) {
        if (v != null) this.setAttribute('helper-text', v)
        else this.removeAttribute('helper-text')
    }

    get ctaLabel(): string {
        return this.getAttribute('cta-label') ?? 'Notify me'
    }
    set ctaLabel(v: string) {
        this.setAttribute('cta-label', v)
    }

    /** Optional mono micro-label rendered above the email field. */
    get fieldLabel(): string {
        return this.getAttribute('field-label') ?? 'Email address'
    }
    set fieldLabel(v: string) {
        this.setAttribute('field-label', v)
    }

    /** Optional social-proof micro-stat, e.g. "2,400+ developers already joined". */
    get stat(): string | null {
        return this.getAttribute('stat')
    }
    set stat(v: string | null) {
        if (v != null) this.setAttribute('stat', v)
        else this.removeAttribute('stat')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'you@email.com'
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get successTitle(): string {
        return this.getAttribute('success-title') ?? "You're on the list."
    }
    set successTitle(v: string) {
        this.setAttribute('success-title', v)
    }

    get successMessage(): string | null {
        return this.getAttribute('success-message')
    }
    set successMessage(v: string | null) {
        if (v != null) this.setAttribute('success-message', v)
        else this.removeAttribute('success-message')
    }

    get variant(): EarlySignupFormVariant {
        const v = this.getAttribute('variant') as EarlySignupFormVariant
        return VARIANTS.includes(v) ? v : 'light'
    }
    set variant(v: EarlySignupFormVariant) {
        this.setAttribute('variant', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get benefits(): string[] {
        return this._benefits
    }
    set benefits(v: string[]) {
        this._benefits = Array.isArray(v) ? v : []
        if (this._initialised) {
            const emailFocused =
                document.activeElement === this.querySelector('input[name="email"]')
            this.render()
            if (emailFocused) {
                this.querySelector<HTMLInputElement>('input[name="email"]')?.focus()
            }
        }
    }

    private _onInput = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.name !== 'email') return
        this._email = input.value
        if (!this._error) return
        // Clear the validation error surgically — no full re-render needed.
        this._error = ''
        const errorEl = this.querySelector('.tc-early-signup-form__error')
        if (errorEl) errorEl.textContent = ''
        input.removeAttribute('aria-describedby')
    }

    private _onClick = (e: Event): void => {
        const target = e.target as HTMLElement
        if (!target.closest('.tc-early-signup-form__reset')) return
        this._submitted = false
        this._email = ''
        this._error = ''
        this.render()
        this.querySelector<HTMLInputElement>('input[name="email"]')?.focus()
    }

    private _onFormSubmit = (e: Event): void => {
        e.preventDefault()
        const form = e.target as HTMLElement
        if (!form.classList.contains('tc-early-signup-form__form')) return

        const inputEl = this.querySelector<HTMLInputElement>('input[name="email"]')
        const email = inputEl?.value ?? this._email
        this._email = email

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this._error = 'Please enter a valid email.'
            // Patch error surgically — avoids destroying input focus.
            const errorId = `${this._idPrefix}-error`
            const errorEl = this.querySelector(`#${errorId}`)
            if (errorEl) errorEl.textContent = this._error
            if (inputEl) inputEl.setAttribute('aria-describedby', errorId)
            inputEl?.focus()
            return
        }

        this._error = ''
        this._submitted = true

        this.dispatchEvent(
            new CustomEvent('tc-submit', {
                bubbles: true,
                composed: true,
                detail: { email },
            }),
        )
        if (typeof this.onSubmit === 'function') this.onSubmit(email)

        this.render()

        // Move focus to success heading so screen readers announce the state change.
        const heading = this.querySelector<HTMLElement>('.tc-early-signup-form__success-title')
        if (heading) {
            heading.setAttribute('tabindex', '-1')
            heading.focus()
        }
    }

    private render(): void {
        const titleText = this.getAttribute('title') ?? 'Get early access'
        const subtitle = this.subtitle
        const eyebrow = this.eyebrow
        const helperText = this.helperText
        const ctaLabel = this.ctaLabel
        const fieldLabel = this.fieldLabel
        const stat = this.stat
        const placeholder = this.placeholder
        const successTitle = this.successTitle
        const successMessage = this.successMessage
        const variant = this.variant
        const loading = this.loading
        const inputId = `${this._idPrefix}-email`
        const errorId = `${this._idPrefix}-error`
        const labelId = `${this._idPrefix}-label`

        // Manage host classes without wiping user-added ones.
        this.classList.add('tc-early-signup-form')
        VARIANTS.forEach((v) => this.classList.remove(`tc-early-signup-form--${v}`))
        this.classList.add(`tc-early-signup-form--${variant}`)
        this.classList.toggle('tc-early-signup-form--submitted', this._submitted)

        // Eyebrow — a 2px cyan brand-dot + mono micro-label. The dot is the one
        // sanctioned spend of the accent in this component.
        const eyebrowHtml = eyebrow
            ? `<span class="tc-early-signup-form__eyebrow">
                   <span class="tc-early-signup-form__dot" aria-hidden="true"></span>
                   <span class="tc-early-signup-form__eyebrow-text">${esc(eyebrow)}</span>
               </span>`
            : ''

        const subtitleHtml = subtitle
            ? `<p class="tc-early-signup-form__subtitle">${esc(subtitle)}</p>`
            : ''

        // Benefits — hairline-separated check rows.
        const benefitsHtml =
            this._benefits.length > 0
                ? `<ul class="tc-early-signup-form__benefits" role="list">
                ${this._benefits
                    .map(
                        (b) => `
                    <li class="tc-early-signup-form__benefit">
                        <span class="tc-early-signup-form__benefit-icon" aria-hidden="true">${checkIconHtml}</span>
                        <span class="tc-early-signup-form__benefit-text">${esc(b)}</span>
                    </li>`,
                    )
                    .join('')}
               </ul>`
                : ''

        // Social-proof micro-stat — mono, faint, hairline-topped footer of the
        // intro zone.
        const statHtml = stat
            ? `<p class="tc-early-signup-form__stat">
                   <span class="tc-early-signup-form__stat-pulse" aria-hidden="true"></span>
                   <span class="tc-early-signup-form__stat-text">${esc(stat)}</span>
               </p>`
            : ''

        let formAreaHtml: string
        if (this._submitted) {
            const msg = successMessage
                ? esc(successMessage)
                : `We'll email <code>${esc(this._email)}</code> when access opens up.`
            formAreaHtml = `
                <div class="tc-early-signup-form__success" role="status">
                    <span class="tc-early-signup-form__success-icon" aria-hidden="true">${checkCircleIconHtml}</span>
                    <strong class="tc-early-signup-form__success-title">${esc(successTitle)}</strong>
                    <span class="tc-early-signup-form__success-message">${msg}</span>
                    <button type="button" class="tc-early-signup-form__reset">
                        Use a different email
                    </button>
                </div>`
        } else {
            const disabledAttr = loading ? ' disabled' : ''
            const submitContent = loading
                ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="visually-hidden">Loading…</span>`
                : `<span class="tc-early-signup-form__submit-label">${esc(ctaLabel)}</span><span class="tc-early-signup-form__submit-icon" aria-hidden="true">${arrowRightIconHtml}</span>`
            formAreaHtml = `
                <form class="tc-early-signup-form__form" novalidate>
                    <span class="tc-early-signup-form__field-label" id="${labelId}">${esc(fieldLabel)}</span>
                    <div class="tc-early-signup-form__field">
                        <label class="visually-hidden" for="${inputId}">${esc(fieldLabel)}</label>
                        <input
                            id="${inputId}"
                            name="email"
                            type="email"
                            class="tc-early-signup-form__input"
                            placeholder="${esc(placeholder)}"
                            value="${esc(this._email)}"
                            autocomplete="email"
                            aria-labelledby="${labelId}"${disabledAttr}
                            required
                        />
                        <button
                            type="submit"
                            class="tc-early-signup-form__submit"${disabledAttr}
                        >${submitContent}</button>
                    </div>
                    <p id="${errorId}"
                       class="tc-early-signup-form__error"
                       aria-live="assertive"
                       aria-atomic="true"
                    >${this._error ? esc(this._error) : ''}</p>
                    ${
                        helperText
                            ? `<p class="tc-early-signup-form__helper">
                        <span class="tc-early-signup-form__helper-mark" aria-hidden="true">${checkIconHtml}</span>
                        <span>${esc(helperText)}</span>
                    </p>`
                            : ''
                    }
                </form>`
        }

        this.innerHTML = `
            <div class="tc-early-signup-form__inner">
                <div class="tc-early-signup-form__intro">
                    ${eyebrowHtml}
                    <h2 class="tc-early-signup-form__title">${esc(titleText)}</h2>
                    ${subtitleHtml}
                    ${benefitsHtml}
                    ${statHtml}
                </div>
                <div class="tc-early-signup-form__form-area">
                    ${formAreaHtml}
                </div>
            </div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EarlySignupForm
    }
}

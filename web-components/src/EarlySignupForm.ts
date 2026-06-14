import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-early-signup-form'

export type EarlySignupFormVariant = 'dark' | 'light'
const VARIANTS: EarlySignupFormVariant[] = ['dark', 'light']

let _idCounter = 0

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

// Pre-compute icons once at module load time
const checkIconHtml = lucideByName('check')
const checkCircleIconHtml = lucideByName('check-circle')

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
            'subtitle', 'eyebrow', 'helper-text', 'cta-label',
            'placeholder', 'success-title', 'success-message', 'variant', 'loading',
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
            const emailFocused = document.activeElement === this.querySelector('input[name="email"]')
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

        this.dispatchEvent(new CustomEvent('tc-submit', {
            bubbles: true,
            composed: true,
            detail: { email },
        }))
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
        const placeholder = this.placeholder
        const successTitle = this.successTitle
        const successMessage = this.successMessage
        const variant = this.variant
        const loading = this.loading
        const inputId = `${this._idPrefix}-email`
        const errorId = `${this._idPrefix}-error`

        // Manage host classes without wiping user-added ones.
        this.classList.add('tc-early-signup-form')
        VARIANTS.forEach(v => this.classList.remove(`tc-early-signup-form--${v}`))
        this.classList.add(`tc-early-signup-form--${variant}`)

        const eyebrowHtml = eyebrow
            ? `<span class="tc-early-signup-form__eyebrow">${esc(eyebrow)}</span>`
            : ''

        const subtitleHtml = subtitle
            ? `<p class="tc-early-signup-form__subtitle">${esc(subtitle)}</p>`
            : ''

        const benefitsHtml = this._benefits.length > 0
            ? `<ul class="tc-early-signup-form__benefits" role="list">
                ${this._benefits.map(b => `
                    <li class="tc-early-signup-form__benefit">
                        <span class="tc-early-signup-form__benefit-icon" aria-hidden="true">${checkIconHtml}</span>
                        <span class="tc-early-signup-form__benefit-text">${esc(b)}</span>
                    </li>`).join('')}
               </ul>`
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
                : esc(ctaLabel)
            formAreaHtml = `
                <form class="tc-early-signup-form__form" novalidate>
                    <label class="visually-hidden" for="${inputId}">Your email address</label>
                    <input
                        id="${inputId}"
                        name="email"
                        type="email"
                        class="tc-early-signup-form__input"
                        placeholder="${esc(placeholder)}"
                        value="${esc(this._email)}"
                        autocomplete="email"${disabledAttr}
                        required
                    />
                    <p id="${errorId}"
                       class="tc-early-signup-form__error"
                       aria-live="assertive"
                       aria-atomic="true"
                    >${this._error ? esc(this._error) : ''}</p>
                    <button
                        type="submit"
                        class="tc-early-signup-form__submit"${disabledAttr}
                    >${submitContent}</button>
                    ${helperText ? `<p class="tc-early-signup-form__helper">${esc(helperText)}</p>` : ''}
                </form>`
        }

        this.innerHTML = `
            <div class="tc-early-signup-form__inner">
                <div class="tc-early-signup-form__intro">
                    ${eyebrowHtml}
                    <h2 class="tc-early-signup-form__title">${esc(titleText)}</h2>
                    ${subtitleHtml}
                    ${benefitsHtml}
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

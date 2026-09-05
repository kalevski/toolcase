import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-newsletter-signup'

let _idCounter = 0

const mailCheckIconHtml = lucideByName('mail-check')

type Status = 'idle' | 'submitting' | 'success' | 'error'

export class NewsletterSignup extends HTMLElement {
    private _initialised = false
    private _status: Status = 'idle'
    private _email = ''
    private _error = ''
    private _idPrefix: string

    /** Optional callback fired alongside the tc-submit CustomEvent. May return a Promise. */
    onSubmit: ((email: string) => Promise<void> | void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-ns-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return [
            // NOTE: 'title' is listed so attributeChangedCallback fires on changes.
            // No getter/setter defined — HTMLElement already reflects title natively.
            'title',
            'description',
            'placeholder',
            'cta-label',
            'success-message',
            'privacy-href',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('input', this._onInput)
        this.addEventListener('submit', this._onFormSubmit)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('submit', this._onFormSubmit)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const emailFocused = document.activeElement === this.querySelector('input[type="email"]')
        this.render()
        if (emailFocused) {
            this.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
        }
    }

    // NOTE: 'title' getter/setter deliberately omitted — HTMLElement already
    // exposes a native .title property that reflects the 'title' attribute.
    // Read via getAttribute('title') inside render().

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'you@example.com'
    }
    set placeholder(v: string) {
        setAttr(this, 'placeholder', v)
    }

    get ctaLabel(): string {
        return this.getAttribute('cta-label') ?? 'Subscribe'
    }
    set ctaLabel(v: string) {
        setAttr(this, 'cta-label', v)
    }

    get successMessage(): string {
        return this.getAttribute('success-message') ?? 'Thanks for subscribing!'
    }
    set successMessage(v: string) {
        setAttr(this, 'success-message', v)
    }

    get privacyHref(): string | null {
        return this.getAttribute('privacy-href')
    }
    set privacyHref(v: string | null) {
        if (v != null) this.setAttribute('privacy-href', v)
        else this.removeAttribute('privacy-href')
    }

    private _onInput = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.type !== 'email') return
        this._email = input.value
        if (!this._error) return
        // Clear the validation error surgically — no full re-render needed.
        this._error = ''
        const errorEl = this.querySelector('.tc-newsletter-signup-error')
        if (errorEl) errorEl.textContent = ''
        input.removeAttribute('aria-invalid')
        input.removeAttribute('aria-describedby')
    }

    private _onFormSubmit = (e: Event): void => {
        e.preventDefault()
        if (this._status === 'submitting') return

        const inputEl = this.querySelector<HTMLInputElement>('input[type="email"]')
        const email = (inputEl?.value ?? this._email).trim()
        this._email = email

        if (!email || !inputEl?.validity.valid) {
            this._error = 'Please enter a valid email address.'
            const errorId = `${this._idPrefix}-error`
            const errorEl = this.querySelector(`#${errorId}`)
            if (errorEl) errorEl.textContent = this._error
            if (inputEl) {
                inputEl.setAttribute('aria-invalid', 'true')
                inputEl.setAttribute('aria-describedby', errorId)
                inputEl.focus()
            }
            return
        }

        this._error = ''
        this._status = 'submitting'
        this.render()

        this.dispatchEvent(
            new CustomEvent('tc-submit', {
                bubbles: true,
                composed: true,
                detail: { email },
            }),
        )

        const handleSuccess = (): void => {
            if (!this.isConnected) return
            this._status = 'success'
            this.render()
            const successEl = this.querySelector<HTMLElement>('.tc-newsletter-signup-success')
            if (successEl) {
                successEl.setAttribute('tabindex', '-1')
                successEl.focus()
            }
        }

        const handleError = (err?: unknown): void => {
            if (!this.isConnected) return
            const msg =
                err instanceof Error && err.message
                    ? err.message
                    : 'Something went wrong. Please try again.'
            this._error = msg
            this._status = 'error'
            this.render()
            this.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
        }

        const promise = typeof this.onSubmit === 'function' ? this.onSubmit(email) : undefined

        if (promise instanceof Promise) {
            promise.then(handleSuccess, handleError)
        } else {
            handleSuccess()
        }
    }

    private render(): void {
        const titleText = this.getAttribute('title')
        const description = this.getAttribute('description')
        const placeholder = this.placeholder
        const ctaLabel = this.ctaLabel
        const successMessage = this.successMessage
        const privacyHref = this.privacyHref
        const inputId = `${this._idPrefix}-email`
        const errorId = `${this._idPrefix}-error`
        const status = this._status

        this.classList.add('tc-newsletter-signup')

        const titleHtml = titleText
            ? `<h2 class="tc-newsletter-signup-title">${esc(titleText)}</h2>`
            : ''

        const descriptionHtml = description
            ? `<p class="tc-newsletter-signup-description">${esc(description)}</p>`
            : ''

        let bodyHtml: string

        if (status === 'success') {
            bodyHtml = `
                <div class="tc-newsletter-signup-success" aria-live="polite" aria-atomic="true">
                    <span class="tc-newsletter-signup-success-icon" aria-hidden="true">${mailCheckIconHtml}</span>
                    <span class="tc-newsletter-signup-success-message">${esc(successMessage)}</span>
                </div>`
        } else {
            const isSubmitting = status === 'submitting'
            const disabledAttr = isSubmitting ? ' disabled' : ''
            const ariaInvalidAttr = this._error ? ' aria-invalid="true"' : ''
            const ariaDescAttr = this._error ? ` aria-describedby="${errorId}"` : ''

            const submitContent = isSubmitting
                ? `<span class="tc-newsletter-signup-spinner" role="status" aria-label="Submitting…"></span>`
                : esc(ctaLabel)

            const privacyHtml = privacyHref
                ? `<a href="${esc(privacyHref)}" class="tc-newsletter-signup-privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a>`
                : ''

            bodyHtml = `
                <form class="tc-newsletter-signup-form" novalidate>
                    <label class="visually-hidden" for="${inputId}">Email address</label>
                    <input
                        id="${inputId}"
                        type="email"
                        class="tc-newsletter-signup-input"
                        placeholder="${esc(placeholder)}"
                        value="${esc(this._email)}"
                        autocomplete="email"
                        required${ariaInvalidAttr}${ariaDescAttr}${disabledAttr}
                    />
                    <button
                        type="submit"
                        class="tc-newsletter-signup-submit"${disabledAttr}
                    >${submitContent}</button>
                    <p id="${errorId}" class="tc-newsletter-signup-error" aria-live="assertive" aria-atomic="true">${this._error ? esc(this._error) : ''}</p>
                    ${privacyHtml}
                </form>`
        }

        patchHtml(
            this,
            `
            <div class="tc-newsletter-signup-inner">
                ${titleHtml}
                ${descriptionHtml}
                ${bodyHtml}
            </div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NewsletterSignup
    }
}

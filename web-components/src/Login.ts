import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-login'

export interface LoginConnectOption {
    key: string
    label: string
    icon?: string
    variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

type ConnectVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
const CONNECT_VARIANTS: ConnectVariant[] = [
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'danger',
]

export class Login extends HTMLElement {
    private _initialised = false
    private _connect: LoginConnectOption[] = []
    private _logoSlotNodes: Element[] = []
    private _patternSlotNodes: Element[] = []

    onconnect: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['title', 'description', 'background-pattern-src', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._logoSlotNodes = Array.from(this.querySelectorAll('[slot="logo"]'))
            this._patternSlotNodes = Array.from(this.querySelectorAll('[slot="pattern"]'))
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._recaptureSlots()
        this.render()
        this._distributeSlots()
    }

    private _distributeSlots(): void {
        const logoEl = this.querySelector('.tc-login-logo')
        if (logoEl) this._logoSlotNodes.forEach((n) => logoEl.appendChild(n))
        const patternEl = this.querySelector('.tc-login-aside-pattern')
        if (patternEl) this._patternSlotNodes.forEach((n) => patternEl.appendChild(n))
    }

    private _recaptureSlots(): void {
        const logoEl = this.querySelector('.tc-login-logo')
        if (logoEl) {
            const nodes = Array.from(logoEl.querySelectorAll('[slot="logo"]'))
            if (nodes.length > 0) this._logoSlotNodes = nodes
        }
        const patternEl = this.querySelector('.tc-login-aside-pattern')
        if (patternEl) {
            const nodes = Array.from(patternEl.querySelectorAll('[slot="pattern"]'))
            if (nodes.length > 0) this._patternSlotNodes = nodes
        }
    }

    // Note: 'title' getter/setter deliberately omitted — HTMLElement already
    // exposes a native .title property that reflects the 'title' attribute.
    // Read via getAttribute('title') inside render().

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get backgroundPatternSrc(): string | null {
        return this.getAttribute('background-pattern-src')
    }
    set backgroundPatternSrc(v: string | null) {
        if (v != null) this.setAttribute('background-pattern-src', v)
        else this.removeAttribute('background-pattern-src')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get connect(): LoginConnectOption[] {
        return this._connect
    }
    set connect(v: LoginConnectOption[]) {
        this._connect = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._recaptureSlots()
            this.render()
            this._distributeSlots()
        }
    }

    private render(): void {
        const bgPatternSrc = this.getAttribute('background-pattern-src')
        const loading = this.loading

        const patternImgHtml = bgPatternSrc
            ? `<img src="${esc(bgPatternSrc)}" alt="" class="tc-login-aside-img" aria-hidden="true" loading="lazy" />`
            : ''
        const asideHtml = `<div class="tc-login-aside" aria-hidden="true"><div class="tc-login-aside-pattern">${patternImgHtml}</div></div>`

        if (loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML =
                `<div class="tc-login">` +
                asideHtml +
                `<div class="tc-login-form">` +
                `<div class="tc-login-form-inner">` +
                `<div class="tc-login-logo"></div>` +
                `<span class="visually-hidden">Loading…</span>` +
                `<div aria-hidden="true">` +
                `<div class="tc-login-skel tc-login-skel--title"></div>` +
                `<div class="tc-login-skel tc-login-skel--desc"></div>` +
                `<div class="tc-login-skel tc-login-skel--btn"></div>` +
                `<div class="tc-login-skel tc-login-skel--btn"></div>` +
                `<div class="tc-login-skel tc-login-skel--btn"></div>` +
                `</div>` +
                `</div>` +
                `</div>` +
                `</div>`
            return
        }

        this.removeAttribute('aria-busy')

        const titleText = this.getAttribute('title') ?? 'Sign in'
        const description = this.getAttribute('description')

        const descHtml = description
            ? `<p class="tc-login-description">${esc(description)}</p>`
            : ''

        const buttons = this._connect
            .map((opt, idx) => {
                const v = opt.variant
                const variant: ConnectVariant = v && CONNECT_VARIANTS.includes(v) ? v : 'primary'
                const svg = opt.icon ? lucideByName(opt.icon) : ''
                const iconHtml = svg
                    ? `<span class="tc-login-connect-btn-icon" aria-hidden="true">${icon(svg, 'tc-login-connect-btn-svg')}</span>`
                    : ''
                return (
                    `<button class="tc-login-connect-btn btn btn-outline-${variant}" type="button" data-idx="${idx}">` +
                    iconHtml +
                    `<span class="tc-login-connect-btn-label">${esc(opt.label)}</span>` +
                    `</button>`
                )
            })
            .join('')

        const connectHtml = buttons
            ? `<div class="tc-login-connect" role="group" aria-label="Sign in options">${buttons}</div>`
            : ''

        this.innerHTML =
            `<div class="tc-login">` +
            asideHtml +
            `<div class="tc-login-form">` +
            `<div class="tc-login-form-inner">` +
            `<div class="tc-login-logo"></div>` +
            `<h2 class="tc-login-title">${esc(titleText)}</h2>` +
            descHtml +
            connectHtml +
            `</div>` +
            `</div>` +
            `</div>`

        const connectEl = this.querySelector('.tc-login-connect')
        if (connectEl) {
            connectEl.addEventListener('click', (e: Event) => {
                const btn = (e.target as Element).closest<HTMLButtonElement>(
                    '.tc-login-connect-btn',
                )
                if (!btn) return
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                const opt = this._connect[idx]
                if (!opt) return
                this.dispatchEvent(
                    new CustomEvent('tc-connect', {
                        bubbles: true,
                        composed: true,
                        detail: { key: opt.key },
                    }),
                )
                if (typeof this.onconnect === 'function') this.onconnect(opt.key)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Login
    }
}

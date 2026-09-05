import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-legal-screen'

export interface LegalSection {
    id: string
    title: string
    body: string
}

export class LegalScreen extends HTMLElement {
    private _initialised = false
    private _sections: LegalSection[] = []
    private _activeId = ''

    onClose: (() => void) | null = null
    onAccept: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['initial-section', 'screen-title', 'show-accept']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
            this._syncActive()
            this.render()
            this._initialised = true
        }
        this._detachHandlers()
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._syncActive()
        this.render()
    }

    get sections(): LegalSection[] {
        return this._sections
    }
    set sections(value: LegalSection[]) {
        this._sections = Array.isArray(value) ? value : []
        this._syncActive()
        if (this._initialised) this.render()
    }

    get initialSection(): string {
        return this.getAttribute('initial-section') ?? ''
    }
    set initialSection(v: string) {
        if (v) this.setAttribute('initial-section', v)
        else this.removeAttribute('initial-section')
    }

    get screenTitle(): string {
        return this.getAttribute('screen-title') ?? 'Legal'
    }
    set screenTitle(v: string) {
        if (v) this.setAttribute('screen-title', v)
        else this.removeAttribute('screen-title')
    }

    get showAccept(): boolean {
        return this.hasAttribute('show-accept')
    }
    set showAccept(v: boolean) {
        if (v) this.setAttribute('show-accept', '')
        else this.removeAttribute('show-accept')
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private _syncActive(): void {
        if (this._sections.length === 0) {
            this._activeId = ''
            return
        }
        const initial = this.initialSection
        if (initial && this._sections.some((s) => s.id === initial)) {
            if (!this._activeId) this._activeId = initial
            return
        }
        if (!this._activeId || !this._sections.some((s) => s.id === this._activeId)) {
            this._activeId = this._sections[0].id
        }
    }

    private _onNavClick = (e: MouseEvent): void => {
        const btn = (e.target as Element)?.closest<HTMLElement>('[data-legal-id]')
        if (!btn) return
        const id = btn.dataset.legalId ?? ''
        if (!id || id === this._activeId) return
        this._activeId = id
        this.render()
    }

    private _onCloseClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.closest('.tc-legal-screen__close')) {
            this.dispatchEvent(
                new CustomEvent('tc-close', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onClose === 'function') this.onClose()
        }
    }

    private _onAcceptClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.closest('.tc-legal-screen__accept')) {
            this.dispatchEvent(
                new CustomEvent('tc-accept', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onAccept === 'function') this.onAccept()
        }
    }

    private _attachHandlers(): void {
        this.addEventListener('click', this._onNavClick)
        this.addEventListener('click', this._onCloseClick)
        this.addEventListener('click', this._onAcceptClick)
    }

    private _detachHandlers(): void {
        this.removeEventListener('click', this._onNavClick)
        this.removeEventListener('click', this._onCloseClick)
        this.removeEventListener('click', this._onAcceptClick)
    }

    private render(): void {
        const navHtml = this._sections
            .map((s) => {
                const isActive = s.id === this._activeId
                const cls = `tc-legal-screen__nav-item${isActive ? ' tc-legal-screen__nav-item--active' : ''}`
                return `<button type="button" class="${cls}" data-legal-id="${esc(s.id)}" aria-current="${isActive ? 'page' : 'false'}">${esc(s.title)}</button>`
            })
            .join('')

        const active = this._sections.find((s) => s.id === this._activeId)
        const bodyHtml = active
            ? `<span class="tc-legal-screen__section-eyebrow">Section</span>
               <h2 class="tc-legal-screen__section-title">${esc(active.title)}</h2>
               <div class="tc-legal-screen__section-body">${esc(active.body)}</div>`
            : `<div class="tc-legal-screen__empty">No sections to display.</div>`

        const footerHtml = this.showAccept
            ? `<footer class="tc-legal-screen__footer">
                   <button type="button" class="tc-legal-screen__accept btn">Accept &amp; Continue</button>
               </footer>`
            : ''

        patchHtml(
            this,
            `<div class="tc-legal-screen">` +
                `<header class="tc-legal-screen__header">` +
                `<div class="tc-legal-screen__header-meta">` +
                `<span class="tc-legal-screen__eyebrow">Legal</span>` +
                `<span class="tc-legal-screen__title">${esc(this.screenTitle)}</span>` +
                `</div>` +
                `<button type="button" class="tc-legal-screen__close" aria-label="${esc(msg('close'))}">${closeIcon}</button>` +
                `</header>` +
                `<div class="tc-legal-screen__grid">` +
                `<nav class="tc-legal-screen__nav" aria-label="Legal sections">${navHtml}</nav>` +
                `<div class="tc-legal-screen__body">${bodyHtml}</div>` +
                `</div>` +
                footerHtml +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LegalScreen
    }
}

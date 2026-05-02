const TAG_NAME = 'gc-legal-screen'

export interface LegalSection {
    id: string
    title: string
    body: string
}

export interface LegalScreenEventMap {
    close: CustomEvent<void>
    accept: CustomEvent<void>
}

export class LegalScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['initial-section', 'screen-title', 'show-accept']
    }

    private _sections: LegalSection[] = []
    private activeId = ''

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.syncActive()
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this.syncActive()
        this.render()
    }

    get sections(): LegalSection[] {
        return this._sections
    }
    set sections(value: LegalSection[]) {
        this._sections = Array.isArray(value) ? value : []
        this.syncActive()
        if (this.isConnected) this.render()
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

    private syncActive(): void {
        if (this._sections.length === 0) {
            this.activeId = ''
            return
        }
        const initial = this.initialSection
        if (initial && this._sections.some((s) => s.id === initial)) {
            if (!this.activeId) this.activeId = initial
            return
        }
        if (!this.activeId || !this._sections.some((s) => s.id === this.activeId)) {
            this.activeId = this._sections[0].id
        }
    }

    private render(): void {
        const navMarkup = this._sections.map((s) => {
            const isActive = s.id === this.activeId
            const cls = `gc-legal-screen-nav-item${isActive ? ' is-active' : ''}`
            return `<button type="button" class="${cls}" data-id="${this.escape(s.id)}" aria-current="${isActive ? 'true' : 'false'}">${this.escape(s.title)}</button>`
        }).join('')

        const active = this._sections.find((s) => s.id === this.activeId)
        const bodyMarkup = active
            ? `<gc-eyebrow class="gc-legal-screen-section-eyebrow">Section</gc-eyebrow>
               <gc-title class="gc-legal-screen-section-title">${this.escape(active.title)}</gc-title>
               <div class="gc-legal-screen-section-body">${this.escape(active.body)}</div>`
            : `<div class="gc-legal-screen-empty">No sections to display.</div>`

        const acceptMarkup = this.showAccept
            ? `<gc-metal-button class="gc-legal-screen-accept" variant="primary">Accept</gc-metal-button>`
            : ''

        this.innerHTML = `
            <div class="gc-legal-screen-root">
                <header class="gc-legal-screen-header">
                    <div class="gc-legal-screen-header-text">
                        <gc-eyebrow class="gc-legal-screen-eyebrow">Legal</gc-eyebrow>
                        <gc-title class="gc-legal-screen-title">${this.escape(this.screenTitle)}</gc-title>
                    </div>
                    <gc-nav-button class="gc-legal-screen-close" kind="close"></gc-nav-button>
                </header>
                <div class="gc-legal-screen-grid">
                    <nav class="gc-legal-screen-nav">${navMarkup}</nav>
                    <div class="gc-legal-screen-body">${bodyMarkup}</div>
                </div>
                <footer class="gc-legal-screen-footer">${acceptMarkup}</footer>
            </div>
        `

        const close = this.querySelector('.gc-legal-screen-close') as HTMLElement | null
        close?.addEventListener('click', () => this.emit('close'))

        const accept = this.querySelector('.gc-legal-screen-accept') as HTMLElement | null
        accept?.addEventListener('click', () => this.emit('accept'))

        this.querySelectorAll<HTMLElement>('.gc-legal-screen-nav-item').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.id || ''
                if (!id || id === this.activeId) return
                this.activeId = id
                this.render()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LegalScreen
    }
}

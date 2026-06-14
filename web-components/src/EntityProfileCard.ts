const TAG_NAME = 'tc-entity-profile-card'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export interface EntityProfileCardMetaItem {
    label: string
    value: string
}

export class EntityProfileCard extends HTMLElement {
    private _initialised = false
    private _meta: EntityProfileCardMetaItem[] = []
    private _leadSlotNodes: Node[] = []
    private _titleSlotNodes: Node[] = []
    private _subtitleSlotNodes: Node[] = []
    private _chipsSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        // 'title' is a native HTMLElement reflected property — list it so attributeChangedCallback
        // fires on changes, but no getter/setter is defined (would collide with the platform).
        return ['title', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            this._leadSlotNodes = Array.from(this.querySelectorAll('[slot="lead"]'))
            this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            this._subtitleSlotNodes = Array.from(this.querySelectorAll('[slot="subtitle"]'))
            this._chipsSlotNodes = Array.from(this.querySelectorAll('[slot="chips"]'))

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

    // 'title' is already a native HTMLElement reflected property — no getter/setter defined.

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get meta(): EntityProfileCardMetaItem[] {
        return this._meta
    }
    set meta(v: EntityProfileCardMetaItem[]) {
        this._meta = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._recaptureSlots()
            this.render()
            this._distributeSlots()
        }
    }

    // Re-capture slot nodes from within their inner containers.
    // Only updates arrays when containers exist — guards against wiping stored nodes
    // when called during or after a loading-state render (containers are absent then).
    private _recaptureSlots(): void {
        const leadEl = this.querySelector('.tc-entity-profile-card__lead')
        if (leadEl) {
            this._leadSlotNodes = Array.from(leadEl.querySelectorAll('[slot="lead"]'))
        }
        const titleEl = this.querySelector('.tc-entity-profile-card__title')
        if (titleEl) {
            this._titleSlotNodes = Array.from(titleEl.querySelectorAll('[slot="title"]'))
        }
        const subtitleEl = this.querySelector('.tc-entity-profile-card__subtitle')
        if (subtitleEl) {
            this._subtitleSlotNodes = Array.from(subtitleEl.querySelectorAll('[slot="subtitle"]'))
        }
        const chipsEl = this.querySelector('.tc-entity-profile-card__chips')
        if (chipsEl) {
            this._chipsSlotNodes = Array.from(chipsEl.querySelectorAll('[slot="chips"]'))
        }
    }

    // Re-append stored slot nodes into their newly rendered inner containers.
    private _distributeSlots(): void {
        const leadEl = this.querySelector('.tc-entity-profile-card__lead')
        if (leadEl) this._leadSlotNodes.forEach(n => leadEl.appendChild(n))

        const titleEl = this.querySelector('.tc-entity-profile-card__title')
        if (titleEl) this._titleSlotNodes.forEach(n => titleEl.appendChild(n))

        const subtitleEl = this.querySelector('.tc-entity-profile-card__subtitle')
        if (subtitleEl) this._subtitleSlotNodes.forEach(n => subtitleEl.appendChild(n))

        const chipsEl = this.querySelector('.tc-entity-profile-card__chips')
        if (chipsEl) this._chipsSlotNodes.forEach(n => chipsEl.appendChild(n))
    }

    private render(): void {
        const loading = this.loading

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const skeletonCells = Array.from({ length: 4 }, () =>
                '<div class="tc-entity-profile-card__meta-cell">' +
                '<div class="tc-entity-profile-card-skeleton tc-entity-profile-card-skeleton--meta-label"></div>' +
                '<div class="tc-entity-profile-card-skeleton tc-entity-profile-card-skeleton--meta-value"></div>' +
                '</div>'
            ).join('')
            this.innerHTML = [
                '<div class="card tc-entity-profile-card" aria-hidden="true">',
                '<div class="tc-entity-profile-card__hero">',
                '<div class="tc-entity-profile-card-skeleton tc-entity-profile-card-skeleton--lead"></div>',
                '<div class="tc-entity-profile-card-skeleton tc-entity-profile-card-skeleton--title"></div>',
                '<div class="tc-entity-profile-card-skeleton tc-entity-profile-card-skeleton--subtitle"></div>',
                '</div>',
                `<dl class="tc-entity-profile-card__meta">${skeletonCells}</dl>`,
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const titleText = this.getAttribute('title') ?? ''
        const hasTitleSlot = this._titleSlotNodes.length > 0
        const hasLead = this._leadSlotNodes.length > 0
        const hasSubtitle = this._subtitleSlotNodes.length > 0
        const hasChips = this._chipsSlotNodes.length > 0

        // Lead: slot container rendered only when slot children are present
        const leadHtml = hasLead
            ? '<div class="tc-entity-profile-card__lead"></div>'
            : ''

        // Title: slot children take priority over the convenience title attribute
        let titleHtml = ''
        if (hasTitleSlot) {
            titleHtml = '<h3 class="tc-entity-profile-card__title"></h3>'
        } else if (titleText) {
            titleHtml = `<h3 class="tc-entity-profile-card__title">${esc(titleText)}</h3>`
        }

        // Subtitle: slot container rendered only when slot children are present
        const subtitleHtml = hasSubtitle
            ? '<div class="tc-entity-profile-card__subtitle"></div>'
            : ''

        // Chips: slot container rendered only when slot children are present
        const chipsHtml = hasChips
            ? '<div class="tc-entity-profile-card__chips"></div>'
            : ''

        const heroHtml = [
            '<div class="tc-entity-profile-card__hero">',
            leadHtml,
            titleHtml,
            subtitleHtml,
            chipsHtml,
            '</div>',
        ].join('')

        const metaHtml = this._meta.length > 0
            ? '<dl class="tc-entity-profile-card__meta">' +
              this._meta.map(item =>
                  '<div class="tc-entity-profile-card__meta-cell">' +
                  `<dt class="tc-entity-profile-card__meta-label">${esc(item.label)}</dt>` +
                  `<dd class="tc-entity-profile-card__meta-value">${esc(item.value)}</dd>` +
                  '</div>'
              ).join('') +
              '</dl>'
            : ''

        this.innerHTML = [
            '<div class="card tc-entity-profile-card">',
            heroHtml,
            metaHtml,
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EntityProfileCard
    }
}

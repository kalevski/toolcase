import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-rich-page-header'

export type RichPageHeaderIconColor =
    | 'violet'
    | 'cyan'
    | 'emerald'
    | 'amber'
    | 'pink'
    | 'blue'
    | 'slate'
    | 'rose'

const ICON_COLORS: RichPageHeaderIconColor[] = [
    'violet',
    'cyan',
    'emerald',
    'amber',
    'pink',
    'blue',
    'slate',
    'rose',
]

export class RichPageHeader extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['title-text', 'sub', 'description', 'icon-name', 'icon-color']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const chipsSlot = Array.from(this.querySelectorAll('[slot="chips"]'))
            const actionsSlot = Array.from(this.querySelectorAll('[slot="actions"]'))

            this.render()

            const chipsEl = this.querySelector('.tc-rich-page-header-chips')
            if (chipsEl) chipsSlot.forEach((n) => chipsEl.appendChild(n))
            const actionsEl = this.querySelector('.tc-rich-page-header-actions')
            if (actionsEl) actionsSlot.forEach((n) => actionsEl.appendChild(n))

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        const chipsSlot = Array.from(
            this.querySelectorAll('.tc-rich-page-header-chips [slot="chips"]'),
        )
        const actionsSlot = Array.from(
            this.querySelectorAll('.tc-rich-page-header-actions [slot="actions"]'),
        )

        this.render()

        const chipsEl = this.querySelector('.tc-rich-page-header-chips')
        if (chipsEl) chipsSlot.forEach((n) => chipsEl.appendChild(n))
        const actionsEl = this.querySelector('.tc-rich-page-header-actions')
        if (actionsEl) actionsSlot.forEach((n) => actionsEl.appendChild(n))
    }

    get titleText(): string | null {
        return this.getAttribute('title-text')
    }
    set titleText(v: string | null) {
        if (v != null) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get sub(): string | null {
        return this.getAttribute('sub')
    }
    set sub(v: string | null) {
        if (v != null) this.setAttribute('sub', v)
        else this.removeAttribute('sub')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get iconName(): string | null {
        return this.getAttribute('icon-name')
    }
    set iconName(v: string | null) {
        if (v != null) this.setAttribute('icon-name', v)
        else this.removeAttribute('icon-name')
    }

    get iconColor(): RichPageHeaderIconColor {
        const v = this.getAttribute('icon-color') as RichPageHeaderIconColor
        return ICON_COLORS.includes(v) ? v : 'slate'
    }
    set iconColor(v: RichPageHeaderIconColor) {
        this.setAttribute('icon-color', v)
    }

    private render(): void {
        const titleText = this.getAttribute('title-text') ?? ''
        const sub = this.getAttribute('sub')
        const description = this.getAttribute('description')
        const iconNameAttr = this.getAttribute('icon-name')
        const iconColor = this.iconColor

        const iconHtml = iconNameAttr
            ? `<span class="tc-rich-page-header-icon tc-rich-page-header-icon--${iconColor}" aria-hidden="true">${lucideByName(iconNameAttr)}</span>`
            : ''

        const subHtml = sub != null ? `<p class="tc-rich-page-header-sub">${esc(sub)}</p>` : ''

        const descriptionHtml =
            description != null
                ? `<p class="tc-rich-page-header-description">${esc(description)}</p>`
                : ''

        this.innerHTML = `<header class="tc-rich-page-header"><div class="tc-rich-page-header-main">${iconHtml}<div class="tc-rich-page-header-body"><div class="tc-rich-page-header-chips"></div><h1 class="tc-rich-page-header-title">${esc(titleText)}</h1>${subHtml}${descriptionHtml}</div></div><div class="tc-rich-page-header-actions"></div></header>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RichPageHeader
    }
}

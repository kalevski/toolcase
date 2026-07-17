import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-empty-state'

/**
 * tc-empty-state — the canonical placeholder for empty tables, tabs, lists and
 * search results. Composition (all optional):
 *
 *   - `icon` attribute — lucide glyph in the tile bubble
 *   - `heading` attribute — short bold line ("No recipes yet")
 *   - `description` attribute — muted explanation under the heading
 *   - default slot — free-form body content (kept for back-compat)
 *   - `slot="action"` children — CTA row (e.g. a tc-button) under the text
 */
export class EmptyState extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['icon', 'heading', 'description']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const children = Array.from(this.childNodes)
            const actionNodes = children.filter(
                (n) => n instanceof Element && n.getAttribute('slot') === 'action',
            )
            const bodyNodes = children.filter(
                (n) => !(n instanceof Element && n.getAttribute('slot') === 'action'),
            )
            this.render()
            this._distribute(bodyNodes, actionNodes)
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const body = this.querySelector('.tc-empty-state__body')
        const action = this.querySelector('.tc-empty-state__action')
        const bodyNodes = body ? Array.from(body.childNodes) : []
        const actionNodes = action ? Array.from(action.childNodes) : []
        this.render()
        this._distribute(bodyNodes, actionNodes)
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get heading(): string | null {
        return this.getAttribute('heading')
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    private _distribute(bodyNodes: Node[], actionNodes: Node[]): void {
        const body = this.querySelector('.tc-empty-state__body')
        if (body) bodyNodes.forEach((n) => body.appendChild(n))
        const action = this.querySelector('.tc-empty-state__action')
        if (action && actionNodes.length > 0) actionNodes.forEach((n) => action.appendChild(n))
    }

    private render(): void {
        const iconName = this.getAttribute('icon')
        let iconHtml = ''
        if (iconName) {
            // lucideByName resolves kebab-case ("folder-git-2") AND PascalCase names.
            const svg = lucideByName(iconName)
            if (svg) {
                iconHtml = `<div class="tc-empty-state__icon">${svg}</div>`
            }
        }
        const heading = this.heading
        const description = this.description
        const headingHtml = heading
            ? `<div class="tc-empty-state__heading">${esc(heading)}</div>`
            : ''
        const descriptionHtml = description
            ? `<div class="tc-empty-state__description">${esc(description)}</div>`
            : ''
        this.innerHTML =
            `<div class="tc-empty-state">` +
            iconHtml +
            headingHtml +
            descriptionHtml +
            `<div class="tc-empty-state__body"></div>` +
            `<div class="tc-empty-state__action"></div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EmptyState
    }
}

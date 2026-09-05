import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { setHostClass } from './internal/host-class'
import { syncOwnedNodes } from './internal/tc-element'

const TAG_NAME = 'tc-empty-state'

/**
 * tc-empty-state — the canonical placeholder for empty tables, tabs, lists and
 * search results. Composition (all optional):
 *
 *   - `icon` attribute — lucide glyph in the tile bubble
 *   - `heading` attribute — short bold line ("No recipes yet")
 *   - `description` attribute — muted explanation under the heading
 *   - default children — free-form body content
 *   - `slot="action"` child — the CTA row under the text
 *
 * THE HOST IS THE LAYOUT. It renders no wrapper and never moves your children.
 * Before 5.1 it captured its child nodes, split them into `.tc-empty-state__body`
 * and `.tc-empty-state__action`, and re-appended them there — so react-dom, which
 * records `tc-empty-state` as the parent of the children it created, threw
 * `NotFoundError` from `parentInstance.removeChild(child)` the moment it removed
 * one of them individually. At 71 call sites in one consuming app that is not a
 * hypothetical.
 *
 * What the element creates — the icon tile, the heading and the description — is
 * PREPENDED, in that order, and never wraps anything. Ordering is CSS: the action
 * region is `order: 1` and everything else falls where the consumer put it.
 *
 * The one contract change that follows: `slot="action"` is now a REGION, not a
 * collector. The CTA row is a single element you supply (it is styled as the row),
 * because a second `slot="action"` child can no longer be folded into the first
 * without moving a node.
 */
export class EmptyState extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['icon', 'heading', 'description', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
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

    private patch(): void {
        setHostClass(this, 'tc-empty-state')
        const iconName = this.getAttribute('icon')
        // lucideByName resolves kebab-case ("folder-git-2") AND PascalCase names.
        const svg = iconName ? lucideByName(iconName) : null
        syncOwnedNodes(this, [
            { cls: 'tc-empty-state__icon', html: svg || null },
            {
                cls: 'tc-empty-state__heading',
                html: this.heading ? esc(this.heading) : null,
            },
            {
                cls: 'tc-empty-state__description',
                html: this.description ? esc(this.description) : null,
            },
        ])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EmptyState
    }
}

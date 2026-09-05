import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { LinkItemBase } from './internal/link-item'

const TAG_NAME = 'tc-breadcrumb-item'

/**
 * tc-breadcrumb-item — a single breadcrumb crumb on the shared
 * {@link LinkItemBase} slot-wrapping scaffold. Renders a linked crumb (`<a>`)
 * unless it is `active` (or has no `href`), in which case no overlay is
 * rendered at all and the label stays plain text on the host, which itself
 * carries `aria-current="page"` when active.
 */
export class BreadcrumbItem extends LinkItemBase {
    static get observedAttributes(): string[] {
        return ['href', 'active']
    }

    protected render(): void {
        const active = this.active
        const href = this.getAttribute('href')

        this.classList.add('breadcrumb-item')
        this.classList.toggle('active', active)

        if (active) {
            this.setAttribute('aria-current', 'page')
        } else {
            this.removeAttribute('aria-current')
        }

        // The crumb's own text stays a child of the host; a linked crumb gets a real
        // <a> stretched over it rather than wrapped around it (rule 1).
        const label = (this.textContent ?? '').trim()
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''
        patchHtml(
            this,
            !active && href != null
                ? `<a href="${esc(href)}" class="tc-breadcrumb-item-content tc-hit-overlay"${nameAttr}></a>`
                : '',
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BreadcrumbItem
    }
}

import { LinkItemBase } from './internal/link-item'

const TAG_NAME = 'tc-breadcrumb-item'

/**
 * tc-breadcrumb-item — a single breadcrumb crumb on the shared
 * {@link LinkItemBase} slot-wrapping scaffold. Renders a linked crumb (`<a>`)
 * unless it is `active` (or has no `href`), in which case it becomes a plain
 * `<span>` marked `aria-current="page"`.
 */
export class BreadcrumbItem extends LinkItemBase {
    static get observedAttributes(): string[] {
        return ['href', 'active']
    }

    protected getContentEl(): HTMLElement | null {
        return this.querySelector<HTMLElement>('.tc-breadcrumb-item-content')
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

        if (!active && href != null) {
            this.innerHTML = `<a href="${href}" class="tc-breadcrumb-item-content"></a>`
        } else {
            this.innerHTML = `<span class="tc-breadcrumb-item-content"></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BreadcrumbItem
    }
}

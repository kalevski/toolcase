import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-empty-state'

export class EmptyState extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['icon']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-empty-state__body')
            if (body) slotContent.forEach((n) => body.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const body = this.querySelector('.tc-empty-state__body')
        const slotContent = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-empty-state__body')
        if (newBody) slotContent.forEach((n) => newBody.appendChild(n))
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
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
        this.innerHTML = `<div class="tc-empty-state">${iconHtml}<div class="tc-empty-state__body"></div></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EmptyState
    }
}

const TAG_NAME = 'gc-scroll-text'

export class ScrollText extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['scroll-title']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.syncTitle()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.syncTitle()
        }
    }

    get scrollTitle(): string {
        return this.getAttribute('scroll-title') || ''
    }
    set scrollTitle(value: string) {
        if (value) this.setAttribute('scroll-title', value)
        else this.removeAttribute('scroll-title')
    }

    private syncTitle(): void {
        const title = this.scrollTitle
        let titleEl = this.querySelector(':scope > [data-gc-scroll-title]') as HTMLElement | null
        if (title) {
            if (!titleEl) {
                titleEl = document.createElement('div')
                titleEl.setAttribute('data-gc-scroll-title', '')
                this.insertBefore(titleEl, this.firstChild)
            }
            titleEl.textContent = `✦ ${title}`
        } else if (titleEl) {
            titleEl.remove()
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScrollText
    }
}

const TAG_NAME = 'tc-scroll-text'

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    return /^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}px` : raw
}

export class ScrollText extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['scroll-title', 'max-height']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-scroll-text__body')
            if (body) slotContent.forEach(n => body.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const body = this.querySelector('.tc-scroll-text__body')
        const slotContent = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-scroll-text__body')
        if (newBody) slotContent.forEach(n => newBody.appendChild(n))
    }

    get scrollTitle(): string {
        return this.getAttribute('scroll-title') ?? ''
    }
    set scrollTitle(v: string) {
        if (v) this.setAttribute('scroll-title', v)
        else this.removeAttribute('scroll-title')
    }

    get maxHeight(): string | null {
        return this.getAttribute('max-height')
    }
    set maxHeight(v: string | null) {
        if (v != null) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
    }

    private render(): void {
        this.classList.add('tc-scroll-text')

        const maxH = resolveLength(this.getAttribute('max-height'))
        if (maxH !== null) {
            this.style.setProperty('--bs-scroll-text-max-height', maxH)
        } else {
            this.style.removeProperty('--bs-scroll-text-max-height')
        }

        const title = this.scrollTitle
        const titleMarkup = title
            ? `<div class="tc-scroll-text__header">${esc(title)}</div>`
            : ''

        this.innerHTML = `${titleMarkup}<div class="tc-scroll-text__body"></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap { [TAG_NAME]: ScrollText }
}

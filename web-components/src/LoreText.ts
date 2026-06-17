const TAG_NAME = 'tc-lore-text'

export class LoreText extends HTMLElement {

    private _initialised = false

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-lore-text__content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    private render(): void {
        this.classList.add('tc-lore-text')
        this.innerHTML = `<div class="tc-lore-text__content"></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap { [TAG_NAME]: LoreText }
}

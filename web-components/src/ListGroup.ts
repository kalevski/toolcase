const TAG_NAME = 'tc-list-group'

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', 'xxl']

export class ListGroup extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['flush', 'numbered', 'horizontal']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const list = this._listEl()
            if (list) slotContent.forEach(n => list.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const list = this._listEl()
        const slotContent = list ? Array.from(list.childNodes) : []
        this.render()
        const newList = this._listEl()
        if (newList) slotContent.forEach(n => newList.appendChild(n))
    }

    get flush(): boolean {
        return this.hasAttribute('flush')
    }
    set flush(v: boolean) {
        if (v) this.setAttribute('flush', '')
        else this.removeAttribute('flush')
    }

    get numbered(): boolean {
        return this.hasAttribute('numbered')
    }
    set numbered(v: boolean) {
        if (v) this.setAttribute('numbered', '')
        else this.removeAttribute('numbered')
    }

    get horizontal(): string | null {
        return this.getAttribute('horizontal')
    }
    set horizontal(v: string | null) {
        if (v != null) this.setAttribute('horizontal', v)
        else this.removeAttribute('horizontal')
    }

    private _listEl(): Element | null {
        return this.querySelector('ul.list-group, ol.list-group')
    }

    private render(): void {
        const numbered = this.hasAttribute('numbered')
        const flush = this.hasAttribute('flush')
        const horizontal = this.getAttribute('horizontal')

        const classes = ['list-group']
        if (flush) classes.push('list-group-flush')
        if (numbered) classes.push('list-group-numbered')
        if (horizontal !== null) {
            if (horizontal && BREAKPOINTS.includes(horizontal)) {
                classes.push(`list-group-horizontal-${horizontal}`)
            } else {
                classes.push('list-group-horizontal')
            }
        }

        const tag = numbered ? 'ol' : 'ul'
        this.innerHTML = `<${tag} class="${classes.join(' ')}"></${tag}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListGroup
    }
}

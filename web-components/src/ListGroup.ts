import { setHostClass } from './internal/host-class'
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
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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

        // THE HOST IS THE LIST: the items the consumer wrote stay their children,
        // and the list semantics come from a role rather than a wrapping <ul> that
        // would have to adopt them (rule 1).
        setHostClass(this, classes.join(' '))
        this.setAttribute('role', 'list')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListGroup
    }
}

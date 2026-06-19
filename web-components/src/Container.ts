const TAG_NAME = 'tc-container'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

const CONTAINER_CLASSES = [
    'container',
    'container-fluid',
    'container-sm',
    'container-md',
    'container-lg',
    'container-xl',
    'container-xxl',
]

export class Container extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['fluid', 'breakpoint']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get fluid(): boolean {
        return this.hasAttribute('fluid')
    }
    set fluid(v: boolean) {
        if (v) this.setAttribute('fluid', '')
        else this.removeAttribute('fluid')
    }

    get breakpoint(): Breakpoint | null {
        const val = this.getAttribute('breakpoint')
        if (val === 'sm' || val === 'md' || val === 'lg' || val === 'xl' || val === 'xxl') {
            return val
        }
        return null
    }
    set breakpoint(v: Breakpoint | null) {
        if (v) this.setAttribute('breakpoint', v)
        else this.removeAttribute('breakpoint')
    }

    private containerClass(): string {
        if (this.fluid) return 'container-fluid'
        const bp = this.breakpoint
        if (bp) return `container-${bp}`
        return 'container'
    }

    private render(): void {
        this.classList.remove(...CONTAINER_CLASSES)
        this.classList.add(this.containerClass())
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Container
    }
}

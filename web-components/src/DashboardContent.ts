import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-dashboard-content'

export class DashboardContent extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    /** THE HOST IS THE MAIN REGION — `role="main"` rather than a `<main>` wrapper,
     *  because wrapping is what re-parents the consumer's children (rule 1). */
    private render(): void {
        setHostClass(this, 'tc-dashboard-content tc-dashboard-content-inner')
        this.setAttribute('role', 'main')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DashboardContent
    }
}

import { ToggleRow } from './ToggleRow'

const TAG_NAME = 'gc-fullscreen-toggle'

export class FullscreenToggle extends ToggleRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Fullscreen')
        super.connectedCallback()
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, FullscreenToggle)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FullscreenToggle
    }
}

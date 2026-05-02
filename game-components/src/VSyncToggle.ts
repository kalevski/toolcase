import { ToggleRow } from './ToggleRow'

const TAG_NAME = 'gc-vsync-toggle'

export class VSyncToggle extends ToggleRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'V-Sync')
        super.connectedCallback()
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, VSyncToggle)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VSyncToggle
    }
}

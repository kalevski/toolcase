import { ToggleRow } from './ToggleRow'

const TAG_NAME = 'gc-invert-axis-toggle'

export class InvertAxisToggle extends ToggleRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Invert Y axis')
        super.connectedCallback()
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, InvertAxisToggle)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InvertAxisToggle
    }
}

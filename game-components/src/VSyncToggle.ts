import { ToggleRow } from './ToggleRow'

const TAG_NAME = 'gc-vsync-toggle'

export class VSyncToggle extends ToggleRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'V-Sync')
        super.connectedCallback()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VSyncToggle
    }
}

import { ToggleRow } from './ToggleRow'

const TAG_NAME = 'gc-fullscreen-toggle'

export class FullscreenToggle extends ToggleRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Fullscreen')
        super.connectedCallback()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FullscreenToggle
    }
}

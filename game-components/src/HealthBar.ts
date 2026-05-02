import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-health-bar'

export class HealthBar extends ResourceBarBase {}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, HealthBar)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HealthBar
    }
}

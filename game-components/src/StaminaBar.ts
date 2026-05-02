import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-stamina-bar'

export class StaminaBar extends ResourceBarBase {}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, StaminaBar)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StaminaBar
    }
}

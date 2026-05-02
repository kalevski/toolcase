import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-mana-bar'

export class ManaBar extends ResourceBarBase {}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ManaBar)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ManaBar
    }
}

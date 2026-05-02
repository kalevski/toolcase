import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-stamina-bar'

export class StaminaBar extends ResourceBarBase {}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StaminaBar
    }
}

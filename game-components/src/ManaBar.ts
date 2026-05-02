import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-mana-bar'

export class ManaBar extends ResourceBarBase {}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ManaBar
    }
}

import { ResourceBarBase } from './ResourceBarBase'

const TAG_NAME = 'gc-health-bar'

export class HealthBar extends ResourceBarBase {}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HealthBar
    }
}

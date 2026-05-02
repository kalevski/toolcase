import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import { styles } from '../styles/HealthBar.styles.js'

@customElement('gc-health-bar')
export class HealthBar extends ResourceBarBase {
    static styles = styles
}

import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import { styles } from '../styles/StaminaBar.styles.js'

@customElement('gc-stamina-bar')
export class StaminaBar extends ResourceBarBase {
    static styles = styles
}

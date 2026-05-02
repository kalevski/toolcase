import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import { styles } from '../styles/ManaBar.styles.js'

@customElement('gc-mana-bar')
export class ManaBar extends ResourceBarBase {
    static styles = styles
}

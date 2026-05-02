import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import { styles } from '../styles/InvertAxisToggle.styles.js'

@customElement('gc-invert-axis-toggle')
export class InvertAxisToggle extends ToggleRow {
    static styles = styles
    constructor() { super(); this.rowLabel = 'Invert Y axis' }
}

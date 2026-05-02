import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import { styles } from '../styles/VSyncToggle.styles.js'

@customElement('gc-vsync-toggle')
export class VSyncToggle extends ToggleRow {
    static styles = styles
    constructor() { super(); this.rowLabel = 'V-Sync' }
}

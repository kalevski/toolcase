import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import { styles } from '../styles/FullscreenToggle.styles.js'

@customElement('gc-fullscreen-toggle')
export class FullscreenToggle extends ToggleRow {
    static styles = styles
    constructor() { super(); this.rowLabel = 'Fullscreen' }
}

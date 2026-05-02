import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import stylesText from '../../style/VSyncToggle.scss'

@customElement('gc-vsync-toggle')
export class VSyncToggle extends ToggleRow {
    static styles = css`${unsafeCSS(stylesText)}`
    constructor() { super(); this.rowLabel = 'V-Sync' }
}

import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import stylesText from '../../style/InvertAxisToggle.scss'

@customElement('gc-invert-axis-toggle')
export class InvertAxisToggle extends ToggleRow {
    static styles = css`${unsafeCSS(stylesText)}`
    constructor() { super(); this.rowLabel = 'Invert Y axis' }
}

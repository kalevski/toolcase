import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ToggleRow } from './ToggleRow.js'
import stylesText from '../../style/FullscreenToggle.scss'

@customElement('gc-fullscreen-toggle')
export class FullscreenToggle extends ToggleRow {
    static styles = css`${unsafeCSS(stylesText)}`
    constructor() { super(); this.rowLabel = 'Fullscreen' }
}

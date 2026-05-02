import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import stylesText from '../../style/StaminaBar.scss'

@customElement('gc-stamina-bar')
export class StaminaBar extends ResourceBarBase {
    static styles = css`${unsafeCSS(stylesText)}`
}

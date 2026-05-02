import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import stylesText from '../../style/ManaBar.scss'

@customElement('gc-mana-bar')
export class ManaBar extends ResourceBarBase {
    static styles = css`${unsafeCSS(stylesText)}`
}

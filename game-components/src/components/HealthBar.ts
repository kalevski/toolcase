import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ResourceBarBase } from './_resource-bar-base.js'
import stylesText from '../../style/HealthBar.scss'

@customElement('gc-health-bar')
export class HealthBar extends ResourceBarBase {
    static styles = css`${unsafeCSS(stylesText)}`
}

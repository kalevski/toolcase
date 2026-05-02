import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/VersionLabel.scss'

@customElement('gc-version-label')
export class VersionLabel extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() version = '0.0.0'
    @property() build = ''
    @property() branch = ''

    render() {
        return html`v${this.version}${this.build ? ` (${this.build})` : ''}${this.branch ? ` · ${this.branch}` : ''}`
    }
}

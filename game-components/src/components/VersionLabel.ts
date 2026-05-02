import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/VersionLabel.styles.js'

@customElement('gc-version-label')
export class VersionLabel extends GameElement {
    static styles = styles

    @property() version = '0.0.0'
    @property() build = ''
    @property() branch = ''

    render() {
        return html`v${this.version}${this.build ? ` (${this.build})` : ''}${this.branch ? ` · ${this.branch}` : ''}`
    }
}

import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ResultScreen } from './ResultScreen.js'
import stylesText from '../../style/VictoryScreen.scss'

@customElement('gc-victory-screen')
export class VictoryScreen extends ResultScreen {
    static styles = css`${unsafeCSS(stylesText)}`

    constructor() {
        super()
        this.titleColor = 'var(--gc-gold, #ffd35a)'
        this.titleText = 'Victory!'
    }
}

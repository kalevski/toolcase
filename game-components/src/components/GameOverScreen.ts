import { css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { ResultScreen } from './ResultScreen.js'
import stylesText from '../../style/GameOverScreen.scss'

@customElement('gc-game-over-screen')
export class GameOverScreen extends ResultScreen {
    static styles = css`${unsafeCSS(stylesText)}`

    constructor() {
        super()
        this.titleColor = 'var(--gc-danger, #d23a3a)'
        this.titleText = 'Game Over'
    }
}

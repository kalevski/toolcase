import { customElement } from 'lit/decorators.js'
import { ResultScreen } from './ResultScreen.js'
import { styles } from '../styles/GameOverScreen.styles.js'

@customElement('gc-game-over-screen')
export class GameOverScreen extends ResultScreen {
    static styles = styles

    constructor() {
        super()
        this.titleColor = 'var(--gc-danger, #d23a3a)'
        this.titleText = 'Game Over'
    }
}

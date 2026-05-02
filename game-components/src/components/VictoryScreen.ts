import { customElement } from 'lit/decorators.js'
import { ResultScreen } from './ResultScreen.js'
import { styles } from '../styles/VictoryScreen.styles.js'

@customElement('gc-victory-screen')
export class VictoryScreen extends ResultScreen {
    static styles = styles

    constructor() {
        super()
        this.titleColor = 'var(--gc-gold, #ffd35a)'
        this.titleText = 'Victory!'
    }
}

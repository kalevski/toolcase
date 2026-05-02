import { ResultScreen, ResultScreenTitleColor } from './ResultScreen'

const TAG_NAME = 'gc-victory-screen'

export class VictoryScreen extends ResultScreen {

    protected defaultTitleText(): string {
        return 'Victory!'
    }

    protected defaultTitleColor(): ResultScreenTitleColor {
        return 'gold'
    }

    protected eyebrowLabel(): string {
        return 'Triumph'
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VictoryScreen
    }
}

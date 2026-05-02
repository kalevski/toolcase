import { ResultScreen, ResultScreenTitleColor } from './ResultScreen'

const TAG_NAME = 'gc-game-over-screen'

export class GameOverScreen extends ResultScreen {

    protected defaultTitleText(): string {
        return 'Game Over'
    }

    protected defaultTitleColor(): ResultScreenTitleColor {
        return 'danger'
    }

    protected eyebrowLabel(): string {
        return 'Defeat'
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GameOverScreen
    }
}

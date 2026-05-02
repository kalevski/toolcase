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

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, GameOverScreen)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GameOverScreen
    }
}

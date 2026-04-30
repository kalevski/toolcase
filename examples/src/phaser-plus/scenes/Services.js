import { Scene } from '@toolcase/phaser-plus'

class ScoreService {

    score = 0

    visits = 0

    bump(points = 10) {
        this.score += points
        return this.score
    }

    visit() {
        this.visits++
        return this.visits
    }
}

class Services extends Scene {

    label = null

    score = null

    onCreate() {
        const { width, height } = this.game.config

        const scoreService = this.services.resolve(ScoreService)
        scoreService.visit()

        this.score = scoreService

        this.label = this.add.text(width / 2, height / 2, '', {
            font: '24px Courier',
            color: '#ffeb3b'
        }).setOrigin(0.5)

        this.refresh()

        this.input.keyboard.on('keydown-SPACE', () => {
            scoreService.bump(10)
            this.refresh()
        })

        this.input.keyboard.on('keydown-R', () => {
            this.restart()
        })
    }

    refresh() {
        this.label.setText(
            `ScoreService is shared across scenes via ServiceRegistry\n\n` +
            `Visits (survives restarts): ${this.score.visits}\n` +
            `Score: ${this.score.score}\n\n` +
            `SPACE = +10 score   R = restart scene (visits++)`
        )
    }
}

export default Services

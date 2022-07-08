import { Feature } from '@toolcase/phaser-plus'

class GameUI extends Feature {

    onCreate() {

        this.fpsText = this.scene.add.bitmapText(20, 15, 'amatic_white', '').setOrigin(0)
        this.fpsText.setFontSize(36)
        this.add(this.fpsText)

    }

    onUpdate() {
        this.fpsText.setText(`FPS: ${Math.floor(this.scene.game.loop.actualFps)}`)
    }

}

export default GameUI
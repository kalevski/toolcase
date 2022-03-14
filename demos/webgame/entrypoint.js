import { Game, Scale, WEBGL } from 'phaser'
import BasicFeatures from './scenes/BasicFeatures'

const game = new Game({
    type: WEBGL,
    antialiasGL: true,
    parent: 'root',
    dom: {
        createContainer: true,                
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    width: 1280,
    height: 720
})

game.scene.add('basic', new BasicFeatures())

game.scene.start('basic')
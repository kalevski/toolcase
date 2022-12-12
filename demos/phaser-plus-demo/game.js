import { Game, Scale, WEBGL } from 'phaser'
import MajorUpdate from './scenes/MajorUpdate'

const screen = new Game({
    type: WEBGL,
    antialiasGL: true,
    parent: 'root',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: {
                y: 5
            },
            debug: true
        }
    },
    dom: {
        createContainer: true
    },
    width: 1280,
    height: 720
})

screen.scene.add('major_update', new MajorUpdate())
screen.scene.start('major_update')
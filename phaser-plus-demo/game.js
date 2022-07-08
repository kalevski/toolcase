import { Game, Scale, WEBGL } from 'phaser'
import Loader from './scenes/Loader'
import World from './scenes/World'

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
            gravity: false,
            debug: true
        }
    },
    dom: {
        createContainer: true
    },
    width: 1280,
    height: 720
})

screen.scene.add('loader', new Loader())
screen.scene.add('world', new World())
screen.scene.start('loader')
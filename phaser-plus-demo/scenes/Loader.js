import { Scene } from '@toolcase/phaser-plus'

class Loader extends Scene {

    onLoad() {
        this.load.image('lobby', '/assets/lobby/lobby-bg.jpg')

        this.load.image('background', '/assets/background.png')
        this.load.spritesheet('character-front-walk', '/assets/characters/character-01-front-walk.png', { frameWidth: 114, frameHeight: 217 })
        this.load.spritesheet('character-side-front-walk', '/assets/characters/character-01-side-front-walk.png', { frameWidth: 96, frameHeight: 229 })
        this.load.spritesheet('character-side-walk', '/assets/characters/character-01-side-walk.png', { frameWidth: 90, frameHeight: 218 })
        this.load.spritesheet('character-side-back-walk', '/assets/characters/character-01-side-back-walk.png', { frameWidth: 95, frameHeight: 224 })
        this.load.spritesheet('character-back-walk', '/assets/characters/character-01-back-walk.png', { frameWidth: 115, frameHeight: 217 })

        this.load.json('character-physics', '/assets/characters/character_physics.json')

        this.load.atlas('guest_01_brewer', '/assets/characters/guest_01_brewer.png', '/assets/characters/guest_01_brewer.json')

        this.load.atlas('hall', [
            '/assets/hall/hall_textures.png',
            '/assets/hall/hall_textures_n.png'
        ], '/assets/hall/hall_textures.json')
        this.load.json('hall-physics', '/assets/hall/hall_physics.json')
      
        this.load.bitmapFont('amatic_white', 'assets/ui/amatic_white.png', 'assets/ui/amatic_white.xml')
        this.load.bitmapFont('amatic_black', 'assets/ui/amatic_black.png', 'assets/ui/amatic_black.xml')
        this.load.bitmapFont('rammetto_one_base', 'assets/ui/rammetto_one_base.png', 'assets/ui/rammetto_one_base.xml')

        this.load.atlas('objects', [
            '/assets/objects/objects.png',
            '/assets/objects/objects_n.png'
        ], '/assets/objects/objects.json')
        this.load.json('object_physics', '/assets/objects/object_physics.json')

        this.load.atlas('ui', '/assets/ui/ui.png', '/assets/ui/ui.json')
    }

    onCreate() {
        this.goTo('world')
    }

}

export default Loader
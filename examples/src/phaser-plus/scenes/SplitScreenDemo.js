import { Feature, Scene, SplitScreen } from '@toolcase/phaser-plus'
import { GameObjects, Input, Math as PhaserMath } from 'phaser'

const SPEED = 0.4

class TwoPlayerInput extends Feature {

    keys = {
        /** @type {Input.Keyboard.Key} */ W: null,
        /** @type {Input.Keyboard.Key} */ A: null,
        /** @type {Input.Keyboard.Key} */ S: null,
        /** @type {Input.Keyboard.Key} */ D: null,
        /** @type {Input.Keyboard.Key} */ I: null,
        /** @type {Input.Keyboard.Key} */ J: null,
        /** @type {Input.Keyboard.Key} */ K: null,
        /** @type {Input.Keyboard.Key} */ L: null
    }

    /** @type {GameObjects.Sprite} */ playerA = null
    /** @type {GameObjects.Sprite} */ playerB = null
    /** @type {PhaserMath.Vector2} */ posA = null
    /** @type {PhaserMath.Vector2} */ posB = null

    onCreate() {
        const kb = this.scene.input.keyboard
        const codes = Input.Keyboard.KeyCodes
        this.keys.W = kb.addKey(codes.W)
        this.keys.A = kb.addKey(codes.A)
        this.keys.S = kb.addKey(codes.S)
        this.keys.D = kb.addKey(codes.D)
        this.keys.I = kb.addKey(codes.I)
        this.keys.J = kb.addKey(codes.J)
        this.keys.K = kb.addKey(codes.K)
        this.keys.L = kb.addKey(codes.L)
    }

    bind(playerA, playerB, posA, posB) {
        this.playerA = playerA
        this.playerB = playerB
        this.posA = posA
        this.posB = posB
    }

    /**
     * @param {number} time
     * @param {number} delta
     */
    onUpdate(time, delta) {
        if (this.playerA === null || this.playerB === null) return

        if (this.keys.W.isDown) this.playerA.y -= SPEED * delta
        if (this.keys.S.isDown) this.playerA.y += SPEED * delta
        if (this.keys.A.isDown) this.playerA.x -= SPEED * delta
        if (this.keys.D.isDown) this.playerA.x += SPEED * delta

        if (this.keys.I.isDown) this.playerB.y -= SPEED * delta
        if (this.keys.K.isDown) this.playerB.y += SPEED * delta
        if (this.keys.J.isDown) this.playerB.x -= SPEED * delta
        if (this.keys.L.isDown) this.playerB.x += SPEED * delta

        this.posA.set(this.playerA.x, this.playerA.y)
        this.posB.set(this.playerB.x, this.playerB.y)
    }

}

class SplitScreenDemo extends Scene {

    /** @type {SplitScreen} */ split = null
    /** @type {TwoPlayerInput} */ input2p = null
    /** @type {GameObjects.Sprite} */ playerA = null
    /** @type {GameObjects.Sprite} */ playerB = null
    /** @type {PhaserMath.Vector2} */ posA = new PhaserMath.Vector2()
    /** @type {PhaserMath.Vector2} */ posB = new PhaserMath.Vector2()

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        this.drawWorldGrid()

        this.playerA = this.add.sprite(-200, 0, 'objects', 'turtle_right')
        this.playerB = this.add.sprite(200, 0, 'objects', 'turtle_left')

        this.posA.set(this.playerA.x, this.playerA.y)
        this.posB.set(this.playerB.x, this.playerB.y)

        this.split = this.features.register('split', SplitScreen)
        this.split.follow(this.posA, this.posB)

        this.input2p = this.features.register('input2p', TwoPlayerInput)
        this.input2p.bind(this.playerA, this.playerB, this.posA, this.posB)

        const hud = this.add.text(0, 0,
            'Player A: WASD\nPlayer B: IJKL\nMove apart to trigger split',
            { color: '#ffffff', fontSize: '18px', backgroundColor: '#00000080', padding: { x: 8, y: 6 } }
        ).setOrigin(0, 0).setScrollFactor(0)

        const ui = this.split.cameras.ui
        if (ui !== null) {
            ui.ignore([this.playerA, this.playerB])
        }
    }

    drawWorldGrid() {
        const g = this.add.graphics()
        g.lineStyle(1, 0x335577, 0.6)
        const half = 2000
        const step = 100
        for (let x = -half; x <= half; x += step) {
            g.beginPath()
            g.moveTo(x, -half)
            g.lineTo(x, half)
            g.strokePath()
        }
        for (let y = -half; y <= half; y += step) {
            g.beginPath()
            g.moveTo(-half, y)
            g.lineTo(half, y)
            g.strokePath()
        }
        g.fillStyle(0x224466, 1)
        for (let x = -half; x <= half; x += 400) {
            for (let y = -half; y <= half; y += 400) {
                g.fillCircle(x, y, 6)
            }
        }
    }

}

export default SplitScreenDemo

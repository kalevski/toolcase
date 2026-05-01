import {
    Scene,
    GestureRecognizer,
    GESTURE_TAP,
    GESTURE_DOUBLE_TAP,
    GESTURE_LONG_PRESS,
    GESTURE_SWIPE,
    GESTURE_PINCH
} from '@toolcase/phaser-plus'

class GestureRecognizerDemo extends Scene {

    /** @type {Phaser.GameObjects.Text} */ log = null
    logLines = []

    onCreate() {
        const { width, height } = this.game.config
        this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 0).setStrokeStyle(2, 0x60a5fa)
        this.add.text(20, 20,
            'Tap, double-tap, long-press, swipe, pinch (two-finger).',
            { color: '#fff', fontSize: '16px' }
        )
        this.log = this.add.text(20, 60, '', { color: '#cbd5e1', fontSize: '14px' })

        const recognizer = this.features.register('gestures', GestureRecognizer)
        recognizer.setConfig({ tapMaxMs: 200, longPressMs: 500, swipeMinDistance: 30 })

        this.features.on(GESTURE_TAP, p => this.append(`tap (${p.x | 0}, ${p.y | 0})`))
        this.features.on(GESTURE_DOUBLE_TAP, p => this.append(`double-tap (${p.x | 0}, ${p.y | 0})`))
        this.features.on(GESTURE_LONG_PRESS, p => this.append(`long-press at (${p.x | 0}, ${p.y | 0})`))
        this.features.on(GESTURE_SWIPE, s => this.append(`swipe ${s.direction} ${s.distance.toFixed(0)}px in ${s.duration.toFixed(0)}ms`))
        this.features.on(GESTURE_PINCH, p => this.append(`pinch scale ${p.scale.toFixed(2)} (Δ${p.delta.toFixed(0)})`))
    }

    append(line) {
        this.logLines.push(line)
        if (this.logLines.length > 14) this.logLines.shift()
        this.log.setText(this.logLines.join('\n'))
    }

}

export default GestureRecognizerDemo

import type { Input } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export const GESTURE_TAP = 'gesture.tap'

export const GESTURE_DOUBLE_TAP = 'gesture.double_tap'

export const GESTURE_LONG_PRESS = 'gesture.long_press'

export const GESTURE_SWIPE = 'gesture.swipe'

export const GESTURE_PINCH = 'gesture.pinch'

export interface GestureConfig {
    tapMaxMs?: number
    tapMaxDistance?: number
    doubleTapMaxGapMs?: number
    longPressMs?: number
    swipeMinDistance?: number
    swipeMaxMs?: number
    pinchThreshold?: number
}

interface PointerSnapshot {
    id: number
    startX: number
    startY: number
    startTime: number
    longPressTimer: number
    longPressFired: boolean
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

export interface SwipeData {
    direction: SwipeDirection
    distance: number
    duration: number
    startX: number
    startY: number
    endX: number
    endY: number
}

export default class GestureRecognizer extends Feature {

    private cfg: Required<GestureConfig>

    private pointers: Map<number, PointerSnapshot> = new Map()

    private lastTapTime: number = 0

    private lastTapX: number = 0

    private lastTapY: number = 0

    private pinchStartDistance: number = 0

    constructor(scene: Scene, key: string) {
        super(scene, key)
        this.cfg = {
            tapMaxMs: 250,
            tapMaxDistance: 12,
            doubleTapMaxGapMs: 320,
            longPressMs: 600,
            swipeMinDistance: 40,
            swipeMaxMs: 500,
            pinchThreshold: 4
        }
    }

    setConfig(config: GestureConfig): this {
        this.cfg = { ...this.cfg, ...config }
        return this
    }

    override onCreate(): void {
        const input = this.scene.input
        input.on('pointerdown', this.onPointerDown, this)
        input.on('pointermove', this.onPointerMove, this)
        input.on('pointerup', this.onPointerUp, this)
        input.on('pointercancel', this.onPointerUp, this)
    }

    override onUpdate(_time: number, delta: number): void {
        for (const snap of this.pointers.values()) {
            if (snap.longPressFired) continue
            snap.longPressTimer += delta
            if (snap.longPressTimer >= this.cfg.longPressMs) {
                snap.longPressFired = true
                this.emit(GESTURE_LONG_PRESS, { id: snap.id, x: snap.startX, y: snap.startY })
            }
        }
    }

    private onPointerDown(pointer: Input.Pointer): void {
        this.pointers.set(pointer.id, {
            id: pointer.id,
            startX: pointer.x,
            startY: pointer.y,
            startTime: performance.now(),
            longPressTimer: 0,
            longPressFired: false
        })
        if (this.pointers.size === 2) {
            this.pinchStartDistance = this.activePinchDistance()
        }
    }

    private onPointerMove(pointer: Input.Pointer): void {
        const snap = this.pointers.get(pointer.id)
        if (snap !== undefined) {
            const dx = pointer.x - snap.startX
            const dy = pointer.y - snap.startY
            if (Math.sqrt(dx * dx + dy * dy) > this.cfg.tapMaxDistance) {
                snap.longPressFired = true
            }
        }
        if (this.pointers.size === 2) {
            const current = this.activePinchDistance()
            const delta = current - this.pinchStartDistance
            if (Math.abs(delta) >= this.cfg.pinchThreshold) {
                this.emit(GESTURE_PINCH, { distance: current, delta, scale: this.pinchStartDistance > 0 ? current / this.pinchStartDistance : 1 })
            }
        }
    }

    private onPointerUp(pointer: Input.Pointer): void {
        const snap = this.pointers.get(pointer.id)
        if (snap === undefined) return
        this.pointers.delete(pointer.id)
        const dx = pointer.x - snap.startX
        const dy = pointer.y - snap.startY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const duration = performance.now() - snap.startTime

        if (distance >= this.cfg.swipeMinDistance && duration <= this.cfg.swipeMaxMs) {
            const direction: SwipeDirection = Math.abs(dx) >= Math.abs(dy)
                ? (dx > 0 ? 'right' : 'left')
                : (dy > 0 ? 'down' : 'up')
            const data: SwipeData = {
                direction,
                distance,
                duration,
                startX: snap.startX,
                startY: snap.startY,
                endX: pointer.x,
                endY: pointer.y
            }
            this.emit(GESTURE_SWIPE, data)
            return
        }

        if (snap.longPressFired) return

        if (distance <= this.cfg.tapMaxDistance && duration <= this.cfg.tapMaxMs) {
            const now = performance.now()
            const tapDx = pointer.x - this.lastTapX
            const tapDy = pointer.y - this.lastTapY
            const tapDist = Math.sqrt(tapDx * tapDx + tapDy * tapDy)
            if (now - this.lastTapTime <= this.cfg.doubleTapMaxGapMs && tapDist <= this.cfg.tapMaxDistance) {
                this.emit(GESTURE_DOUBLE_TAP, { x: pointer.x, y: pointer.y })
                this.lastTapTime = 0
            } else {
                this.emit(GESTURE_TAP, { x: pointer.x, y: pointer.y })
                this.lastTapTime = now
                this.lastTapX = pointer.x
                this.lastTapY = pointer.y
            }
        }
    }

    private activePinchDistance(): number {
        const list = Array.from(this.pointers.values())
        if (list.length < 2) return 0
        const a = this.scene.input.manager.pointers.find(p => p.id === list[0]!.id)
        const b = this.scene.input.manager.pointers.find(p => p.id === list[1]!.id)
        if (!a || !b) return 0
        const dx = a.x - b.x
        const dy = a.y - b.y
        return Math.sqrt(dx * dx + dy * dy)
    }

    override onDestroy(): void {
        const input = this.scene.input
        input.off('pointerdown', this.onPointerDown, this)
        input.off('pointermove', this.onPointerMove, this)
        input.off('pointerup', this.onPointerUp, this)
        input.off('pointercancel', this.onPointerUp, this)
        this.pointers.clear()
    }

}

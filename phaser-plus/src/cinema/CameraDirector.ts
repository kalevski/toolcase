import type { Cameras, GameObjects } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import type ScreenShake from './ScreenShake'

export type Easing = (t: number) => number

export const EASE_LINEAR: Easing = t => t

export const EASE_IN_OUT: Easing = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

export const EASE_OUT: Easing = t => 1 - (1 - t) * (1 - t)

export interface FollowTarget {
    x: number
    y: number
}

export interface FollowShot {
    type: 'follow'
    target: FollowTarget | (GameObjects.GameObject & FollowTarget)
    lerp?: number
    offsetX?: number
    offsetY?: number
}

export interface PanShot {
    type: 'pan'
    x: number
    y: number
    duration: number
    ease?: Easing
}

export interface ZoomShot {
    type: 'zoom'
    zoom: number
    duration: number
    ease?: Easing
}

export interface BoundsShot {
    type: 'fit-bounds'
    x: number
    y: number
    width: number
    height: number
    duration: number
    ease?: Easing
    padding?: number
}

export interface SplineShot {
    type: 'spline'
    points: Array<{ x: number, y: number }>
    duration: number
    ease?: Easing
    loop?: boolean
}

export type Shot = FollowShot | PanShot | ZoomShot | BoundsShot | SplineShot

export const SHOT_DONE = 'camera_director.shot_done'

export default class CameraDirector extends Feature {

    private camera: Cameras.Scene2D.Camera | null = null

    private shake: ScreenShake | null = null

    private queue: Shot[] = []

    private active: Shot | null = null

    private startX: number = 0

    private startY: number = 0

    private startZoom: number = 1

    private elapsed: number = 0

    private bound: boolean = false

    /** Base camera position before the first timed cinematic shot started (excludes any shake offset). */
    private preScrollX: number = 0

    private preScrollY: number = 0

    private preZoom: number = 1

    private hasPre: boolean = false

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setCamera(camera: Cameras.Scene2D.Camera): this {
        this.camera = camera
        this.bound = true
        return this
    }

    /**
     * Link a ScreenShake instance that shares the same camera so the director
     * can cooperate with it instead of clobbering its additive offset.
     *
     * When linked, every absolute scroll write performed by the director
     * includes the current shake offset on top of the tweened base position.
     * startShot() also strips the shake offset from its startX/Y snapshot so
     * the tween travels between true base positions rather than shake-polluted
     * ones.  Both orderings of the two features' onUpdate calls produce the
     * same result: the camera always lands on tweenedBase + currentShakeOffset
     * at the end of each frame.
     */
    setShake(shake: ScreenShake): this {
        this.shake = shake
        return this
    }

    push(shot: Shot): this {
        this.queue.push(shot)
        return this
    }

    cut(shot: Shot): this {
        this.queue = [shot]
        this.active = null
        return this
    }

    clear(): this {
        this.queue = []
        this.active = null
        if (this.hasPre && this.camera !== null) {
            this.restorePreState(this.camera)
        }
        return this
    }

    skip(): this {
        if (this.active !== null) this.completeActive()
        return this
    }

    get currentShot(): Shot | null {
        return this.active
    }

    override onCreate(): void {
        if (!this.bound) this.camera = this.scene.cameras.main
    }

    override onUpdate(_time: number, delta: number): void {
        const camera = this.camera
        if (camera === null) return
        const dt = delta / 1000

        if (this.active === null) {
            const next = this.queue.shift()
            if (!next) return
            this.startShot(next, camera)
        }

        switch (this.active!.type) {
            case 'follow': this.tickFollow(this.active as FollowShot, camera, dt); break
            case 'pan': this.tickPan(this.active as PanShot, camera, dt); break
            case 'zoom': this.tickZoom(this.active as ZoomShot, camera, dt); break
            case 'fit-bounds': this.tickBounds(this.active as BoundsShot, camera, dt); break
            case 'spline': this.tickSpline(this.active as SplineShot, camera, dt); break
        }
    }

    override onDestroy(): void {
        if (this.hasPre && this.camera !== null) {
            this.restorePreState(this.camera)
        }
        this.queue = []
        this.active = null
    }

    private startShot(shot: Shot, camera: Cameras.Scene2D.Camera): void {
        const sx = this.shake
        const shakeX = sx !== null ? sx.offsetX : 0
        const shakeY = sx !== null ? sx.offsetY : 0

        if (shot.type === 'follow') {
            // Follow is the "normal" camera mode — clear the cinematic snapshot so
            // we do not restore to the pre-pan position when follow eventually ends.
            this.hasPre = false
        } else if (!this.hasPre) {
            // First timed cinematic shot: remember where the camera was so we can
            // restore it after the whole sequence is done.
            this.preScrollX = camera.scrollX - shakeX
            this.preScrollY = camera.scrollY - shakeY
            this.preZoom = camera.zoom
            this.hasPre = true
        }

        this.active = shot
        // Store the BASE scroll position (without shake) so tween math operates on
        // true world positions.  tick* methods add the shake offset back on top.
        this.startX = camera.scrollX - shakeX
        this.startY = camera.scrollY - shakeY
        this.startZoom = camera.zoom
        this.elapsed = 0
    }

    private completeActive(): void {
        const finished = this.active
        this.active = null
        if (finished !== null) this.emit(SHOT_DONE, finished)
        // Restore camera to its pre-cinematic base position when the director
        // runs out of shots, undoing any permanent scroll/zoom left by pan/zoom.
        if (this.queue.length === 0 && this.hasPre && this.camera !== null) {
            this.restorePreState(this.camera)
        }
    }

    private restorePreState(camera: Cameras.Scene2D.Camera): void {
        if (!this.hasPre) return
        const sx = this.shake
        camera.scrollX = this.preScrollX + (sx !== null ? sx.offsetX : 0)
        camera.scrollY = this.preScrollY + (sx !== null ? sx.offsetY : 0)
        camera.zoom = this.preZoom
        this.hasPre = false
    }

    private tickFollow(shot: FollowShot, camera: Cameras.Scene2D.Camera, _dt: number): void {
        const target = shot.target as FollowTarget
        const tx = target.x + (shot.offsetX ?? 0)
        const ty = target.y + (shot.offsetY ?? 0)
        const lerp = shot.lerp ?? 0.1
        camera.scrollX += (tx - camera.width * 0.5 - camera.scrollX) * lerp
        camera.scrollY += (ty - camera.height * 0.5 - camera.scrollY) * lerp
    }

    private tickPan(shot: PanShot, camera: Cameras.Scene2D.Camera, dt: number): void {
        this.elapsed += dt
        const t = Math.min(1, this.elapsed / shot.duration)
        const ease = shot.ease ?? EASE_IN_OUT
        const e = ease(t)
        const targetX = shot.x - camera.width * 0.5
        const targetY = shot.y - camera.height * 0.5
        const sx = this.shake
        const shakeX = sx !== null ? sx.offsetX : 0
        const shakeY = sx !== null ? sx.offsetY : 0
        camera.scrollX = this.startX + (targetX - this.startX) * e + shakeX
        camera.scrollY = this.startY + (targetY - this.startY) * e + shakeY
        if (t >= 1) this.completeActive()
    }

    private tickZoom(shot: ZoomShot, camera: Cameras.Scene2D.Camera, dt: number): void {
        this.elapsed += dt
        const t = Math.min(1, this.elapsed / shot.duration)
        const ease = shot.ease ?? EASE_IN_OUT
        const e = ease(t)
        camera.zoom = this.startZoom + (shot.zoom - this.startZoom) * e
        if (t >= 1) this.completeActive()
    }

    private tickBounds(shot: BoundsShot, camera: Cameras.Scene2D.Camera, dt: number): void {
        this.elapsed += dt
        const t = Math.min(1, this.elapsed / shot.duration)
        const ease = shot.ease ?? EASE_IN_OUT
        const e = ease(t)
        const padding = shot.padding ?? 0
        const w = shot.width + padding * 2
        const h = shot.height + padding * 2
        const targetZoom = Math.min(camera.width / w, camera.height / h)
        const cx = shot.x + shot.width * 0.5
        const cy = shot.y + shot.height * 0.5
        const targetScrollX = cx - (camera.width * 0.5) / targetZoom
        const targetScrollY = cy - (camera.height * 0.5) / targetZoom
        const sx = this.shake
        const shakeX = sx !== null ? sx.offsetX : 0
        const shakeY = sx !== null ? sx.offsetY : 0
        camera.zoom = this.startZoom + (targetZoom - this.startZoom) * e
        camera.scrollX = this.startX + (targetScrollX - this.startX) * e + shakeX
        camera.scrollY = this.startY + (targetScrollY - this.startY) * e + shakeY
        if (t >= 1) this.completeActive()
    }

    private tickSpline(shot: SplineShot, camera: Cameras.Scene2D.Camera, dt: number): void {
        this.elapsed += dt
        let t = this.elapsed / shot.duration
        if (shot.loop && t >= 1) {
            this.elapsed = this.elapsed % shot.duration
            t = this.elapsed / shot.duration
        }
        t = Math.min(1, t)
        const ease = shot.ease ?? EASE_LINEAR
        const e = ease(t)
        const point = catmullRom(shot.points, e)
        const sx = this.shake
        const shakeX = sx !== null ? sx.offsetX : 0
        const shakeY = sx !== null ? sx.offsetY : 0
        camera.scrollX = point.x - camera.width * 0.5 + shakeX
        camera.scrollY = point.y - camera.height * 0.5 + shakeY
        if (!shot.loop && t >= 1) this.completeActive()
    }

}

function catmullRom(points: Array<{ x: number, y: number }>, t: number): { x: number, y: number } {
    if (points.length === 0) return { x: 0, y: 0 }
    if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y }
    const segCount = points.length - 1
    const segT = t * segCount
    const i = Math.min(Math.floor(segT), segCount - 1)
    const localT = segT - i
    const p0 = points[Math.max(i - 1, 0)]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[Math.min(i + 2, points.length - 1)]!
    const t2 = localT * localT
    const t3 = t2 * localT
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * localT + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * localT + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    return { x, y }
}

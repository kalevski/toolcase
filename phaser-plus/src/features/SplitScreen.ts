import { Cameras, Filters, GameObjects, Geom, Math as PhaserMath } from 'phaser'
import Feature from './Feature'
import type Scene from '../engine/Scene'

type Mode = 'SINGLE' | 'SPLIT'

const FOLLOW_LERP = 0.1
const ANGLE_QUANTUM_DEG = 1
const CAMERA_RANGE_RATIO = 0.5
const OFFSET_RANGE_RATIO = 0.7

export default class SplitScreen extends Feature {

    cameras: {
        ui: Cameras.Scene2D.Camera | null
        A: Cameras.Scene2D.Camera | null
        B: Cameras.Scene2D.Camera | null
    } = { ui: null, A: null, B: null }

    private width = 0
    private height = 0

    private viewport = new Geom.Rectangle()
    private V1 = new PhaserMath.Vector2()
    private V2 = new PhaserMath.Vector2()
    private V3 = new PhaserMath.Vector2()
    private V4 = new PhaserMath.Vector2()
    private VC = new PhaserMath.Vector2()

    private cameraEllipse = new Geom.Ellipse()
    private offsetEllipse = new Geom.Ellipse()
    private splitLine = new Geom.Line()
    private breakpoint = 0

    private points: { A: PhaserMath.Vector2 | null, B: PhaserMath.Vector2 | null } = { A: null, B: null }
    private centroid = new PhaserMath.Vector2()
    private tempOffset = new PhaserMath.Vector2()

    private gfxA: GameObjects.Graphics | null = null
    private gfxB: GameObjects.Graphics | null = null
    private maskA: Filters.Mask | null = null
    private maskB: Filters.Mask | null = null

    private polygon1: PhaserMath.Vector2[] = []
    private polygon2: PhaserMath.Vector2[] = []
    private intersectOut: PhaserMath.Vector2[] = []

    private mode: Mode = 'SINGLE'
    private angleHash: number = Number.NaN
    private _originalMainCameraName: string = ''

    private splitEnter: number = 1.0
    private splitExitSq: number = 0.85 * 0.85

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setSplitThresholds(enter: number, exit: number): this {
        if (enter <= 0 || exit <= 0 || exit >= enter) {
            throw new Error('thresholds: 0 < exit < enter')
        }
        this.splitEnter = enter
        this.splitExitSq = exit * exit
        return this
    }

    override onCreate(): void {
        const { width, height } = this.scene.game.config as unknown as { width: number, height: number }
        this.width = width
        this.height = height
        this.viewport.setTo(0, 0, width, height)
        this.V1.set(0, 0)
        this.V2.set(width, 0)
        this.V3.set(width, height)
        this.V4.set(0, height)
        this.VC.set(width * 0.5, height * 0.5)

        this.cameraEllipse.setTo(0, 0, width * CAMERA_RANGE_RATIO, height * CAMERA_RANGE_RATIO)
        this.offsetEllipse.setTo(0, 0, width * OFFSET_RANGE_RATIO, height * OFFSET_RANGE_RATIO)
        this.splitLine.setTo(-width / 2, height / 2, width * 1.5, height / 2)
        this.breakpoint = -(PhaserMath.RadToDeg(PhaserMath.Angle.BetweenPoints(this.V1, this.VC)) + 90)

        this.gfxA = new GameObjects.Graphics(this.scene)
        this.gfxB = new GameObjects.Graphics(this.scene)

        this._originalMainCameraName = this.scene.cameras.main.name
        this.cameras.ui = this.scene.cameras.main.setName('ui')
        this.cameras.B = this.scene.cameras.add(0, 0, width, height, false, 'gameplay B')
        this.cameras.A = this.scene.cameras.add(0, 0, width, height, false, 'gameplay A')
        this.scene.cameras.cameras.reverse()

        this.cameras.A.visible = false
        this.cameras.B.visible = false

        this.enterSingle()
    }

    override onUpdate(_time: number, _delta: number): void {
        const A = this.points.A
        const B = this.points.B
        if (A === null || B === null) return
        const camA = this.cameras.A
        const camB = this.cameras.B
        if (camA === null || camB === null) return

        this.centroid.set((A.x + B.x) * 0.5, (A.y + B.y) * 0.5)
        this.cameraEllipse.setPosition(this.centroid.x, this.centroid.y)
        this.offsetEllipse.setPosition(this.centroid.x, this.centroid.y)

        const rx = this.cameraEllipse.width * 0.5
        const ry = this.cameraEllipse.height * 0.5
        const ndx = (A.x - this.centroid.x) / rx
        const ndy = (A.y - this.centroid.y) / ry
        const distSq = ndx * ndx + ndy * ndy

        if (this.mode === 'SINGLE' && distSq > this.splitEnter) {
            this.mode = 'SPLIT'
            this.enterSplit()
        } else if (this.mode === 'SPLIT' && distSq < this.splitExitSq) {
            this.mode = 'SINGLE'
            this.enterSingle()
        }

        if (this.mode === 'SPLIT') {
            this.refreshMasks()
            this.refreshOffsets()
        }
    }

    override onDestroy(): void {
        const camsScene = this.scene.cameras
        this.detachMask(this.cameras.A, this.maskA)
        this.detachMask(this.cameras.B, this.maskB)
        // Reverse cameras back to original order before removing A and B so main ends up at index 0.
        camsScene.cameras.reverse()
        if (this.cameras.A !== null) camsScene.remove(this.cameras.A)
        if (this.cameras.B !== null) camsScene.remove(this.cameras.B)
        // Restore the original name of cameras.main (was renamed to 'ui' in onCreate).
        camsScene.main.setName(this._originalMainCameraName)
        this.gfxA?.destroy()
        this.gfxB?.destroy()
        this.maskA = null
        this.maskB = null
        this.gfxA = null
        this.gfxB = null
        this.cameras.A = null
        this.cameras.B = null
        this.cameras.ui = null
        this.points.A = null
        this.points.B = null
    }

    follow(pointA: PhaserMath.Vector2, pointB: PhaserMath.Vector2): void {
        this.points.A = pointA
        this.points.B = pointB
    }

    unfollow(): void {
        this.points.A = null
        this.points.B = null
    }

    private enterSingle(): void {
        const camA = this.cameras.A
        const camB = this.cameras.B
        if (camA === null || camB === null) return

        this.detachMask(camA, this.maskA)
        this.detachMask(camB, this.maskB)
        this.maskA = null
        this.maskB = null

        camA.setFollowOffset(0, 0)
        camA.startFollow(this.centroid as unknown as GameObjects.GameObject, false, FOLLOW_LERP, FOLLOW_LERP)
        camB.stopFollow()

        camA.visible = true
        camB.visible = false

        this.angleHash = Number.NaN
    }

    private enterSplit(): void {
        const camA = this.cameras.A
        const camB = this.cameras.B
        const pA = this.points.A
        const pB = this.points.B
        if (camA === null || camB === null || pA === null || pB === null) return

        camA.startFollow(pA as unknown as GameObjects.GameObject, false, FOLLOW_LERP, FOLLOW_LERP)
        camB.startFollow(pB as unknown as GameObjects.GameObject, false, FOLLOW_LERP, FOLLOW_LERP)
        camA.visible = true
        camB.visible = true

        this.angleHash = Number.NaN
        this.refreshMasks()
        this.refreshOffsets()
    }

    private refreshMasks(): void {
        const pA = this.points.A
        const pB = this.points.B
        const camA = this.cameras.A
        const camB = this.cameras.B
        const gfxA = this.gfxA
        const gfxB = this.gfxB
        if (pA === null || pB === null || camA === null || camB === null || gfxA === null || gfxB === null) return

        const angle = PhaserMath.RadToDeg(PhaserMath.Angle.BetweenPoints(pA, pB))
        const hash = Math.round(angle / ANGLE_QUANTUM_DEG)
        if (hash === this.angleHash) return
        this.angleHash = hash

        this.splitLine.setTo(-this.width / 2, this.height / 2, this.width * 1.5, this.height / 2)
        Geom.Line.Rotate(this.splitLine, PhaserMath.DegToRad(angle + 90))

        const inverted = !(angle > this.breakpoint && angle < this.breakpoint + 180)

        this.intersectOut.length = 0
        const intersect = Geom.Intersects.GetLineToRectangle(this.splitLine, this.viewport, this.intersectOut)
        if (intersect.length < 2) return
        const iA = intersect[0]
        const iB = intersect[1]

        this.polygon1.length = 0
        this.polygon2.length = 0

        if (iA.x === this.width && iB.x === 0) {
            this.polygon1.push(iA, iB, this.V4, this.V3)
            this.polygon2.push(iA, iB, this.V1, this.V2)
        } else if (iA.y === 0 && iB.y === this.height) {
            this.polygon1.push(iA, iB, this.V4, this.V1)
            this.polygon2.push(iA, iB, this.V3, this.V2)
        } else {
            return
        }

        const polyForA = inverted ? this.polygon2 : this.polygon1
        const polyForB = inverted ? this.polygon1 : this.polygon2

        gfxA.clear()
        gfxA.fillStyle(0xffffff)
        gfxA.fillPoints(polyForA, true)
        if (this.maskA === null) {
            this.maskA = this.attachMask(camA, gfxA)
        }

        gfxB.clear()
        gfxB.fillStyle(0xffffff)
        gfxB.fillPoints(polyForB, true)
        if (this.maskB === null) {
            this.maskB = this.attachMask(camB, gfxB)
        }
    }

    private attachMask(cam: Cameras.Scene2D.Camera, gfx: GameObjects.Graphics): Filters.Mask | null {
        const c = cam as unknown as { enableFilters?: () => void, filters: { internal: { addMask: (mask: GameObjects.GameObject, invert?: boolean, viewCamera?: Cameras.Scene2D.Camera, viewTransform?: 'local' | 'world') => Filters.Mask } } | null }
        if (typeof c.enableFilters === 'function') c.enableFilters()
        if (c.filters === null || c.filters === undefined) return null
        return c.filters.internal.addMask(gfx, false, this.scene.cameras.main, 'local')
    }

    private detachMask(cam: Cameras.Scene2D.Camera | null, mask: Filters.Mask | null): void {
        if (cam === null || mask === null) return
        const list = (cam as unknown as { filters: { internal: { remove: (filter: Filters.Mask) => void } } | null }).filters
        if (list === null || list === undefined) return
        list.internal.remove(mask)
    }

    private refreshOffsets(): void {
        const pA = this.points.A
        const pB = this.points.B
        const camA = this.cameras.A
        const camB = this.cameras.B
        if (pA === null || pB === null || camA === null || camB === null) return

        if (this.offsetEllipse.contains(pA.x, pA.y)) {
            camA.setFollowOffset(pA.x - this.centroid.x, pA.y - this.centroid.y)
            camB.setFollowOffset(pB.x - this.centroid.x, pB.y - this.centroid.y)
            return
        }

        const angle = PhaserMath.RadToDeg(PhaserMath.Angle.BetweenPoints(pA, pB)) + 360
        this.cameraEllipse.getPoint(((angle + 180) % 360) / 360, this.tempOffset)
        camA.setFollowOffset(this.tempOffset.x - this.centroid.x, this.tempOffset.y - this.centroid.y)
        this.cameraEllipse.getPoint((angle % 360) / 360, this.tempOffset)
        camB.setFollowOffset(this.tempOffset.x - this.centroid.x, this.tempOffset.y - this.centroid.y)
    }
}

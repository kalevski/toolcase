import { Cameras, GameObjects, Geom, Math, Time } from 'phaser'
import Feature from '../Feature'

class SplitScreen extends Feature {

    cameras = {
        /** @type {Cameras.Scene2D.Camera} */
        ui: null,

        /** @type {Cameras.Scene2D.Camera} */
        A: null,

        /** @type {Cameras.Scene2D.Camera} */
        B: null
    }

    /** @private */
    viewport = new Geom.Rectangle()

    /** @private */
    VP = {
        V1: new Geom.Point(),
        V2: new Geom.Point(),
        V3: new Geom.Point(),
        V4: new Geom.Point(),
        CENTER: new Geom.Point()
    }

    /** @private */
    points = {
        /** @type {Math.Vector2} */
        A: null,
        /** @type {Math.Vector2} */
        B: null
    }

    /**
     * @private
     */
    centroid = new Geom.Point(0, 0)

    /** @private */
    range = {
        /** @type {Geom.Ellipse} */
        cameraMode: null,
        /** @type {Geom.Ellipse} */
        offsetMode: null
    }

    /**
     * @private
     * @type {Geom.Line}
     */
    splitLine = null

    /**
     * @private
     */
    loops = {
        /** @type {Time.TimerEvent} */
        split: null,
        /** @type {Time.TimerEvent} */
        offset: null
    }

    /**
     * @private
     * @type {('SINGLE'|'SPLIT'})}
     */
    mode = null

    /** @private */
    masks = {
        A: new Geom.Polygon(),
        B: new Geom.Polygon(),
        gfxA: new GameObjects.Graphics(this.scene),
        gfxB: new GameObjects.Graphics(this.scene),
        hash: null
    }

    tempOffset = new Geom.Point(0, 0)
    
    /** @protected */
    onCreate() {
        
        const { width, height } = this.scene.game.config
        this.viewport.setSize(width, height)
        this.VP.V1.setTo(this.viewport.x, this.viewport.y)
        this.VP.V2.setTo(this.viewport.width, this.viewport.y)
        this.VP.V3.setTo(this.viewport.width, this.viewport.height)
        this.VP.V4.setTo(this.viewport.x, this.viewport.height)
        this.VP.CENTER.setTo(this.viewport.width / 2, this.viewport.height / 2)
        
        this.range.cameraMode = new Geom.Ellipse(0, 0, width * .5, height * .5)
        this.range.offsetMode = new Geom.Ellipse(0, 0, width * .7, height * .7)
        this.splitLine = new Geom.Line(-width / 2, height / 2, width * 1.5, height / 2)
        this.splitLine.reset = function reset() {
            this.setTo(-width / 2, height / 2, width * 1.5, height / 2)
        }

        this.cameras.ui = this.scene.cameras.main.setName('ui')
        this.cameras.B = this.scene.cameras.add(0, 0, width, height, false, 'gameplay B')
        this.cameras.A = this.scene.cameras.add(0, 0, width, height, false, 'gameplay A')
        this.scene.cameras.cameras.reverse()

        this.cameras.A.ignore(this)
        this.cameras.B.ignore(this)

        this.cameras.A.visible = false
        this.cameras.B.visible = false
        
        this.loops.split = this.scene.time.addEvent({
            delay: 500,
            callback: this.onCameraUpdate,
            callbackScope: this,
            loop: true
        })

        this.loops.offset = this.scene.time.addEvent({
            delay: 500,
            callback: this.setCameraOffset,
            callbackScope: this,
            loop: true
        })

        this.loops.offset.paused = true

        this.enterSingleCamera()
        this.mode = 'SINGLE'
    }

    /** @protected */
    onDestroy() {

    }

    onUpdate() {
        if (this.points.A === null || this.points.B === null) {
            return
        }

        this.centroid.setTo(0, 0)
        Geom.Point.GetCentroid([this.points.A, this.points.B], this.centroid)

        this.range.cameraMode.setPosition(this.centroid.x, this.centroid.y)
        this.range.offsetMode.setPosition(this.centroid.x, this.centroid.y)

        let nextMode = this.range.cameraMode.contains(this.points.A.x, this.points.A.y) ? 'SINGLE' : 'SPLIT'
        if (nextMode === 'SINGLE' && this.mode === 'SPLIT') {
            this.enterSingleCamera()
        }
        if (nextMode === 'SPLIT' && this.mode === 'SINGLE') {
            this.enterSplitCamera()
            this.onSplitCamera()
        }
        this.mode = nextMode
    }

    /** @protected */
    onCameraUpdate() {
        if (this.points.A === null || this.points.B === null) {
            return
        }
        if (this.mode === 'SPLIT') {
            this.onSplitCamera()
        }
    }

    /** @protected */
    enterSingleCamera() {
        this.cameras.A.setLerp(1)
        this.cameras.B.setLerp(1)

        this.cameras.A.clearMask()
        this.cameras.A.startFollow(this.centroid)
        this.cameras.B.stopFollow()

        this.cameras.A.visible = true
        this.cameras.B.visible = false

        this.cameras.B.visible = false

        this.loops.offset.paused = true
    }

    /** @protected */
    enterSplitCamera() {
        this.cameras.A.visible = true
        this.cameras.A.startFollow(this.points.A)

        this.cameras.B.visible = true
        this.cameras.B.startFollow(this.points.B)

        this.masks.hash = null

        this.setCameraOffset(false)
        this.loops.offset.paused = false
    }

    /** @protected */
    onSplitCamera() {
        this.splitLine.reset()
        let angle = Math.RadToDeg(Math.Angle.BetweenPoints(this.points.A, this.points.B))
        Geom.Line.Rotate(this.splitLine, Math.DegToRad(angle + 90))

        let hash = Math.RoundTo(angle, 0).toString()
        if (this.masks.hash === hash) {
            return
        }
        this.masks.hash = hash

        let breakpoint = -(Math.RadToDeg(Math.Angle.BetweenPoints(this.VP.V1, this.VP.CENTER)) + 90)
        let inverted = !(angle > breakpoint && angle < breakpoint + 180)

        /** @type {Array<Geom.Point>} */
        let intersect = Geom.Intersects.GetLineToRectangle(this.splitLine, this.viewport, this.masks.intersectPoints)
        const [ A, B ] = intersect
        let polygon1 = []
        let polygon2 = []
        if (A.x === this.viewport.width && B.x === this.viewport.x) {
            polygon1.push(A, B, this.VP.V4, this.VP.V3)
            polygon2.push(A, B, this.VP.V1, this.VP.V2)
        } else if (A.y === this.viewport.y && B.y === this.viewport.height) {
            polygon1.push(A, B, this.VP.V4, this.VP.V1)
            polygon2.push(A, B, this.VP.V3, this.VP.V2)
        } else {
            return
        }

        if (inverted) {
            this.masks.A.setTo(polygon2)
            this.masks.B.setTo(polygon1)
        } else {
            this.masks.A.setTo(polygon1)
            this.masks.B.setTo(polygon2)
        }

        this.masks.gfxA.clear()
        this.masks.gfxA.fillStyle(0xffffff)
        this.masks.gfxA.fillPoints(this.masks.A.points, true)
        let maskA = this.masks.gfxA.createGeometryMask()
        this.cameras.A.setMask(maskA)
        
        this.masks.gfxB.clear()
        this.masks.gfxB.fillStyle(0xffffff)
        this.masks.gfxB.fillPoints(this.masks.B.points, true)
        let maskB = this.masks.gfxB.createGeometryMask()
        this.cameras.B.setMask(maskB)
    }

    /** @protected */
    setCameraOffset(lerpEnabled = true) {
        
        if (this.range.offsetMode.contains(this.points.A.x, this.points.A.y)) {
            this.cameras.A.setFollowOffset(this.points.A.x - this.centroid.x, this.points.A.y - this.centroid.y)
            this.cameras.B.setFollowOffset(this.points.B.x - this.centroid.x, this.points.B.y - this.centroid.y)
        } else {
            let angle = Math.RadToDeg(Math.Angle.BetweenPoints(this.points.A, this.points.B)) + 360
            this.range.cameraMode.getPoint(((angle + 180) % 360) / 360, this.tempOffset)
            this.cameras.A.setFollowOffset(this.tempOffset.x - this.centroid.x, this.tempOffset.y - this.centroid.y)
            this.range.cameraMode.getPoint(((angle) % 360) / 360, this.tempOffset)
            this.cameras.B.setFollowOffset(this.tempOffset.x - this.centroid.x, this.tempOffset.y - this.centroid.y)
        }

        if (lerpEnabled) {
            this.cameras.A.setLerp(.03)
            this.cameras.B.setLerp(.03)
        }
        
    }
    

    /**
     * 
     * @param {Math.Vector2} pointA
     * @param {Math.Vector2} pointB
     */
    follow(pointA, pointB) {
        this.unfollow()
        this.points.A = pointA
        this.points.B = pointB
    }

    unfollow() {
        this.points.A = null
        this.points.B = null
    }
}

export default SplitScreen
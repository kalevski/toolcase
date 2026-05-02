import { NavMesh, PathFinder, PATH_FOUND, PATH_FAILED, Scene } from '@toolcase/phaser-plus'

const W = 32
const H = 18
const SIZE = 40

class GridMesh extends NavMesh {

    walls = new Set()

    isBlocked(x, y) {
        if (x < 0 || y < 0 || x >= W || y >= H) return true
        return this.walls.has(`${x}|${y}`)
    }

    toggle(x, y) {
        const key = `${x}|${y}`
        if (this.walls.has(key)) this.walls.delete(key)
        else this.walls.add(key)
    }

}

class PathFinderDemo extends Scene {

    /** @type {GridMesh} */ mesh = null
    /** @type {PathFinder} */ finder = null
    /** @type {import('phaser').GameObjects.Arc} */ player = null
    /** @type {import('phaser').GameObjects.Graphics} */ gfx = null
    /** @type {Array<{x: number, y: number}>} */ waypoints = []
    /** @type {string} */ status = 'idle'

    cellX = 0
    cellY = 0

    onCreate() {
        this.mesh = new GridMesh()
        this.finder = this.features.register('finder', PathFinder)
        this.finder.setMesh(this.mesh)

        for (let i = 0; i < 60; i++) {
            const x = Math.floor(Math.random() * W)
            const y = Math.floor(Math.random() * H)
            if (x === 0 && y === 0) continue
            this.mesh.walls.add(`${x}|${y}`)
        }

        this.gfx = this.add.graphics()
        this.player = this.add.circle(SIZE / 2, SIZE / 2, 12, 0x4caf50).setStrokeStyle(2, 0xffffff)

        this.input.mouse.disableContextMenu()
        this.input.on('pointerdown', this.onPointerDown, this)

        this.add.text(8, 8,
            'Left-click: walk here. Right-click: toggle wall. Random walls placed.',
            { color: '#ffffff', fontSize: '14px', backgroundColor: '#000000aa', padding: { x: 8, y: 6 } }
        ).setScrollFactor(0).setDepth(10)

        this.statusText = this.add.text(8, H * SIZE - 28,
            'status: idle',
            { color: '#ffeb3b', fontSize: '13px', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } }
        ).setScrollFactor(0).setDepth(10)
    }

    onPointerDown(pointer) {
        const cx = Math.floor(pointer.x / SIZE)
        const cy = Math.floor(pointer.y / SIZE)
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) return

        if (pointer.rightButtonDown()) {
            if (cx === this.cellX && cy === this.cellY) return
            this.mesh.toggle(cx, cy)
            return
        }

        this.requestPath(cx, cy)
    }

    requestPath(ex, ey) {
        this.status = 'searching...'
        this.waypoints = []
        const path = this.finder.findPath(this.cellX, this.cellY, ex, ey, 1000)
        path.on(PATH_FOUND, (points) => {
            this.waypoints = points.slice(1)
            this.status = `found (${points.length} cells)`
        })
        path.on(PATH_FAILED, (reason) => {
            this.waypoints = []
            this.status = `failed: ${reason}`
        })
    }

    onUpdate(_time, delta) {
        if (this.waypoints.length > 0) {
            const next = this.waypoints[0]
            const tx = next.x * SIZE + SIZE / 2
            const ty = next.y * SIZE + SIZE / 2
            const dx = tx - this.player.x
            const dy = ty - this.player.y
            const dist = Math.hypot(dx, dy)
            const speed = 0.4 * delta
            if (dist <= speed) {
                this.player.x = tx
                this.player.y = ty
                this.cellX = next.x
                this.cellY = next.y
                this.waypoints.shift()
            } else {
                this.player.x += (dx / dist) * speed
                this.player.y += (dy / dist) * speed
            }
        }

        this.drawGrid()
        this.statusText.setText(`status: ${this.status} | cell=(${this.cellX},${this.cellY}) walls=${this.mesh.walls.size}`)
    }

    drawGrid() {
        const g = this.gfx
        g.clear()

        g.fillStyle(0x111a22, 1)
        g.fillRect(0, 0, W * SIZE, H * SIZE)

        g.lineStyle(1, 0x223344, 0.6)
        for (let x = 0; x <= W; x++) {
            g.beginPath()
            g.moveTo(x * SIZE, 0)
            g.lineTo(x * SIZE, H * SIZE)
            g.strokePath()
        }
        for (let y = 0; y <= H; y++) {
            g.beginPath()
            g.moveTo(0, y * SIZE)
            g.lineTo(W * SIZE, y * SIZE)
            g.strokePath()
        }

        g.fillStyle(0x884444, 1)
        for (const key of this.mesh.walls) {
            const [wxs, wys] = key.split('|')
            const wx = parseInt(wxs, 10)
            const wy = parseInt(wys, 10)
            g.fillRect(wx * SIZE + 1, wy * SIZE + 1, SIZE - 2, SIZE - 2)
        }

        if (this.waypoints.length > 0) {
            g.lineStyle(3, 0xffeb3b, 0.85)
            g.beginPath()
            g.moveTo(this.player.x, this.player.y)
            for (const p of this.waypoints) {
                g.lineTo(p.x * SIZE + SIZE / 2, p.y * SIZE + SIZE / 2)
            }
            g.strokePath()

            const last = this.waypoints[this.waypoints.length - 1]
            g.fillStyle(0xffeb3b, 1)
            g.fillCircle(last.x * SIZE + SIZE / 2, last.y * SIZE + SIZE / 2, 6)
        }
    }

}

export default PathFinderDemo

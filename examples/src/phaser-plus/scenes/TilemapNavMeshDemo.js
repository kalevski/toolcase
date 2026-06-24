import { TilemapFeature, PathFinder, PATH_FOUND, PATH_FAILED, Scene } from '@toolcase/phaser-plus'

const COLS = 28
const ROWS = 16
const TILE = 36

const FLOOR = 0
const WALL  = 1

function makeMap() {
    const m = []
    for (let r = 0; r < ROWS; r++) {
        const row = []
        for (let c = 0; c < COLS; c++) {
            const border = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1
            row.push(border ? WALL : FLOOR)
        }
        m.push(row)
    }

    const walls = [
        [2,2],[2,3],[2,4],[2,5],[2,6],
        [5,2],[5,3],[5,4],
        [4,7],[5,7],[6,7],[7,7],[8,7],
        [10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],
        [12,4],[12,5],[12,6],[12,7],[12,8],[12,9],[12,10],[12,11],
        [14,2],[14,3],[15,3],[16,3],[17,3],
        [16,5],[16,6],[16,7],[16,8],[16,9],
        [18,2],[18,3],[18,4],[18,5],
        [20,2],[20,3],[20,4],[20,5],[20,6],[20,7],
        [22,3],[22,4],[22,5],[22,6],[22,7],[22,8],
        [24,2],[24,3],[25,3],[25,4],[25,5],
        [14,10],[15,10],[16,10],[17,10],[18,10],[19,10],[20,10],
        [8,10],[8,11],[8,12],[8,13],
        [14,12],[14,13],[15,12],[16,12],[17,12],
        [4,10],[4,11],[4,12],[5,10],[6,10],
    ]
    for (const [c, r] of walls) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = WALL
    }
    return m
}

const MAP_DATA = makeMap()

class TilemapNavMeshDemo extends Scene {

    /** @type {import('@toolcase/phaser-plus').TilemapFeature} */ tilemap = null
    /** @type {import('@toolcase/phaser-plus').PathFinder} */ finder = null
    /** @type {import('phaser').GameObjects.Arc} */ agent = null
    /** @type {import('phaser').GameObjects.Graphics} */ gfx = null
    /** @type {Array<{x:number,y:number}>} */ waypoints = []
    /** @type {string} */ status = 'idle'

    agentCol = 1
    agentRow = 1

    onCreate() {
        this.tilemap = this.features.register('tilemap', TilemapFeature)
        this.tilemap.createFromData(MAP_DATA, TILE, TILE)

        const navMesh = this.tilemap.buildNavMesh({ walkable: [FLOOR], layer: 0 })

        this.finder = this.features.register('finder', PathFinder)
        this.finder.setMesh(navMesh)
        this.finder.budgetMs = 2

        this.gfx = this.add.graphics()

        this.agent = this.add.circle(
            this.agentCol * TILE + TILE / 2,
            this.agentRow * TILE + TILE / 2,
            10,
            0x4ade80
        ).setStrokeStyle(2, 0xffffff).setDepth(2)

        this.input.mouse?.disableContextMenu()
        this.input.on('pointerdown', this.onPointerDown, this)

        this.add.text(8, 8,
            'Left-click: walk here   Right-click: toggle wall',
            {
                color: '#f8fafc',
                fontSize: '13px',
                backgroundColor: '#0f172acc',
                padding: { x: 8, y: 5 }
            }
        ).setScrollFactor(0).setDepth(10)

        this.statusText = this.add.text(8, ROWS * TILE - 28, 'status: idle', {
            color: '#fbbf24',
            fontSize: '12px',
            backgroundColor: '#0f172acc',
            padding: { x: 6, y: 4 }
        }).setScrollFactor(0).setDepth(10)
    }

    onPointerDown(pointer) {
        const col = Math.floor(pointer.x / TILE)
        const row = Math.floor(pointer.y / TILE)
        if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return

        if (pointer.rightButtonDown()) {
            if (col === this.agentCol && row === this.agentRow) return
            const current = MAP_DATA[row][col]
            if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return
            MAP_DATA[row][col] = current === WALL ? FLOOR : WALL
            this.tilemap.createFromData(MAP_DATA, TILE, TILE)
            const newMesh = this.tilemap.buildNavMesh({ walkable: [FLOOR], layer: 0 })
            this.finder.setMesh(newMesh)
            this.waypoints = []
            return
        }

        if (MAP_DATA[row][col] === WALL) return
        this.requestPath(col, row)
    }

    requestPath(col, row) {
        this.status = 'searching…'
        this.waypoints = []
        const path = this.finder.findPath(this.agentCol, this.agentRow, col, row, 2000)
        path.on(PATH_FOUND, (points) => {
            this.waypoints = points.slice(1)
            this.status = `found (${points.length} steps)`
        })
        path.on(PATH_FAILED, (reason) => {
            this.waypoints = []
            this.status = `failed: ${reason}`
        })
    }

    onUpdate(_time, delta) {
        if (this.waypoints.length > 0) {
            const next = this.waypoints[0]
            const tx = next.x * TILE + TILE / 2
            const ty = next.y * TILE + TILE / 2
            const dx = tx - this.agent.x
            const dy = ty - this.agent.y
            const dist = Math.hypot(dx, dy)
            const speed = 0.35 * delta
            if (dist <= speed) {
                this.agent.x = tx
                this.agent.y = ty
                this.agentCol = next.x
                this.agentRow = next.y
                this.waypoints.shift()
            } else {
                this.agent.x += (dx / dist) * speed
                this.agent.y += (dy / dist) * speed
            }
        }

        this.drawMap()
        this.statusText.setText(`status: ${this.status} | agent=(${this.agentCol},${this.agentRow})`)
    }

    drawMap() {
        const g = this.gfx
        g.clear()

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const isWall = MAP_DATA[r][c] === WALL
                g.fillStyle(isWall ? 0x334155 : 0x0f172a, 1)
                g.fillRect(c * TILE, r * TILE, TILE, TILE)
                g.lineStyle(1, 0x1e293b, 0.5)
                g.strokeRect(c * TILE, r * TILE, TILE, TILE)
            }
        }

        if (this.waypoints.length > 0) {
            g.lineStyle(3, 0xfbbf24, 0.9)
            g.beginPath()
            g.moveTo(this.agent.x, this.agent.y)
            for (const p of this.waypoints) {
                g.lineTo(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2)
            }
            g.strokePath()

            const goal = this.waypoints[this.waypoints.length - 1]
            g.fillStyle(0xfbbf24, 1)
            g.fillCircle(goal.x * TILE + TILE / 2, goal.y * TILE + TILE / 2, 6)
        }
    }

}

export default TilemapNavMeshDemo

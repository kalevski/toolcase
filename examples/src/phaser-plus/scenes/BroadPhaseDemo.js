import { Scene, Structs } from '@toolcase/phaser-plus'

// Broad-phase demo: a field of moving bodies indexed in BOTH a SpatialHash and a
// Quadtree every frame. The cursor drives a range query() (highlighting overlapping
// bodies) and a nearest() lookup (ringed + connected to the cursor). Press S to switch
// which structure answers the queries — the highlights are identical, proving both
// broad-phases agree while exercising their different internals.

const CELL = 80          // SpatialHash cell size (px)
const QT_CAPACITY = 8    // Quadtree items-per-node before split
const QT_MAX_DEPTH = 8   // Quadtree max subdivision depth
const BODIES = 260
const SEED = 1337

class BroadPhaseDemo extends Scene {

    /** @type {InstanceType<typeof Structs.SpatialHash>} */ hash = null
    /** @type {InstanceType<typeof Structs.Quadtree>} */ quadtree = null
    /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number}>} */ bodies = []
    /** @type {import('phaser').GameObjects.Graphics} */ gfx = null

    mode = 'hash'            // 'hash' | 'quadtree'
    paused = false
    queryRadius = 110        // half-extent of the cursor query rectangle
    pointer = { x: 640, y: 360 }
    hitCount = 0
    nearestDist = -1

    onCreate() {
        const { width, height } = this.scale

        const rng = new Structs.Random(SEED)
        this.bodies = []
        for (let i = 0; i < BODIES; i++) {
            const r = rng.float(6, 18)
            this.bodies.push({
                x: rng.float(r, width - r),
                y: rng.float(r, height - r),
                vx: rng.float(-90, 90),
                vy: rng.float(-90, 90),
                r
            })
        }

        // Build both broad-phases over the same world bounds.
        this.hash = new Structs.SpatialHash(CELL)
        this.quadtree = new Structs.Quadtree(
            { x: 0, y: 0, width, height },
            QT_CAPACITY,
            QT_MAX_DEPTH
        )
        for (const b of this.bodies) {
            const bounds = this.boundsOf(b)
            this.hash.insert(b, bounds)
            this.quadtree.insert(b, bounds)
        }

        this.gfx = this.add.graphics()

        this.input.on('pointermove', (p) => { this.pointer.x = p.x; this.pointer.y = p.y })
        this.input.on('wheel', (_p, _o, _dx, dy) => {
            const next = this.queryRadius + (dy > 0 ? -12 : 12)
            this.queryRadius = Math.max(30, Math.min(320, next))
        })
        this.input.keyboard.on('keydown-S', () => {
            this.mode = this.mode === 'hash' ? 'quadtree' : 'hash'
        })
        this.input.keyboard.on('keydown-SPACE', () => { this.paused = !this.paused })

        this.add.text(8, 8,
            'Move cursor: range query + nearest.  [S] switch structure  ·  [Wheel] query size  ·  [Space] pause',
            { color: '#ffffff', fontSize: '14px', backgroundColor: '#000000aa', padding: { x: 8, y: 6 } }
        ).setDepth(10)

        this.statusText = this.add.text(8, height - 30, '',
            { color: '#ffeb3b', fontSize: '13px', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } }
        ).setDepth(10)
    }

    /** Axis-aligned bounds rect for a body (SpatialRect shape). */
    boundsOf(b) {
        return { x: b.x - b.r, y: b.y - b.r, width: b.r * 2, height: b.r * 2 }
    }

    onUpdate(_time, delta) {
        const { width, height } = this.scale
        const dt = delta / 1000

        if (!this.paused) {
            for (const b of this.bodies) {
                b.x += b.vx * dt
                b.y += b.vy * dt
                if (b.x < b.r) { b.x = b.r; b.vx = -b.vx }
                else if (b.x > width - b.r) { b.x = width - b.r; b.vx = -b.vx }
                if (b.y < b.r) { b.y = b.r; b.vy = -b.vy }
                else if (b.y > height - b.r) { b.y = height - b.r; b.vy = -b.vy }
                // Re-index the moved body in BOTH structures.
                const bounds = this.boundsOf(b)
                this.hash.update(b, bounds)
                this.quadtree.update(b, bounds)
            }
        }

        this.draw()
    }

    draw() {
        const g = this.gfx
        const { width, height } = this.scale
        const struct = this.mode === 'hash' ? this.hash : this.quadtree

        const qr = this.queryRadius
        const region = {
            x: this.pointer.x - qr,
            y: this.pointer.y - qr,
            width: qr * 2,
            height: qr * 2
        }

        const hits = struct.query(region)
        const hitSet = new Set(hits)
        const nearest = struct.nearest({ x: this.pointer.x, y: this.pointer.y })
        this.hitCount = hits.length
        this.nearestDist = nearest
            ? Math.round(Math.hypot(nearest.x - this.pointer.x, nearest.y - this.pointer.y))
            : -1

        g.clear()
        g.fillStyle(0x0d141b, 1)
        g.fillRect(0, 0, width, height)

        // Structure overlay: uniform grid for the hash, world frame for the quadtree.
        if (this.mode === 'hash') {
            g.lineStyle(1, 0x1d2b38, 0.8)
            for (let x = 0; x <= width; x += CELL) {
                g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.strokePath()
            }
            for (let y = 0; y <= height; y += CELL) {
                g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.strokePath()
            }
        } else {
            g.lineStyle(1, 0x1d2b38, 0.9)
            g.strokeRect(0.5, 0.5, width - 1, height - 1)
        }

        // Bodies — dim by default, bright when inside the query region.
        for (const b of this.bodies) {
            if (hitSet.has(b)) g.fillStyle(0xffd54f, 1)
            else g.fillStyle(0x3a4d5e, 1)
            g.fillCircle(b.x, b.y, b.r)
        }

        // Query rectangle.
        g.lineStyle(2, 0xffd54f, 0.9)
        g.strokeRect(region.x, region.y, region.width, region.height)

        // Nearest body — cyan ring + connector from the cursor.
        if (nearest) {
            g.lineStyle(2, 0x29e3ff, 0.95)
            g.strokeCircle(nearest.x, nearest.y, nearest.r + 5)
            g.beginPath()
            g.moveTo(this.pointer.x, this.pointer.y)
            g.lineTo(nearest.x, nearest.y)
            g.strokePath()
        }

        // Cursor crosshair.
        g.fillStyle(0x29e3ff, 1)
        g.fillCircle(this.pointer.x, this.pointer.y, 3)

        const label = this.mode === 'hash'
            ? `SpatialHash (cell ${CELL}px)`
            : `Quadtree (cap ${QT_CAPACITY}, depth ${QT_MAX_DEPTH})`
        this.statusText.setText(
            `structure: ${label} | indexed=${struct.size} | query hits=${this.hitCount} | nearest=${this.nearestDist}px | radius=${this.queryRadius}px${this.paused ? ' | PAUSED' : ''}`
        )
    }

    onDestroy() {
        this.hash?.clear()
        this.quadtree?.clear()
    }

}

export default BroadPhaseDemo

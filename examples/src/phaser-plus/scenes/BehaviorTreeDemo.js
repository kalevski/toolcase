import {
    Scene,
    Sequence,
    Selector,
    Action,
    Condition,
    BehaviorTreeProcessor,
    SUCCESS,
    FAILURE,
    RUNNING
} from '@toolcase/phaser-plus'

class BehaviorTreeDemo extends Scene {

    /** @type {Phaser.GameObjects.Arc} */ agent = null
    /** @type {Phaser.GameObjects.Arc} */ player = null
    /** @type {Phaser.GameObjects.Text} */ label = null

    onCreate() {
        const { width, height } = this.game.config
        const cx = width / 2
        const cy = height / 2

        this.player = this.add.circle(cx, cy, 12, 0x60a5fa)
        this.agent = this.add.circle(cx - 200, cy, 14, 0xf97316)
        this.label = this.add.text(20, 20, '', { color: '#cbd5e1', fontSize: '16px' })

        this.add.text(20, height - 30, 'Move mouse: agent chases when close, otherwise patrols.', { color: '#94a3b8', fontSize: '14px' })

        this.input.on('pointermove', p => { this.player.x = p.worldX; this.player.y = p.worldY })

        const blackboard = {
            patrolPoints: [
                { x: cx - 220, y: cy - 120 },
                { x: cx - 60, y: cy - 120 },
                { x: cx - 60, y: cy + 120 },
                { x: cx - 220, y: cy + 120 }
            ],
            patrolIndex: 0,
            visionRange: 220,
            agent: this.agent,
            player: this.player,
            label: this.label,
            speed: 90
        }

        const sees = new Condition(({ blackboard: bb }) => {
            const dx = bb.player.x - bb.agent.x
            const dy = bb.player.y - bb.agent.y
            const inRange = Math.sqrt(dx * dx + dy * dy) <= bb.visionRange
            bb.label.setText(`mode: ${inRange ? 'CHASE' : 'PATROL'}`)
            return inRange
        })

        const moveTo = (selector) => new Action(({ blackboard: bb, delta }) => {
            const target = selector(bb)
            const dx = target.x - bb.agent.x
            const dy = target.y - bb.agent.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 6) return SUCCESS
            const step = bb.speed * (delta / 1000)
            bb.agent.x += (dx / dist) * step
            bb.agent.y += (dy / dist) * step
            return RUNNING
        })

        const advancePatrol = new Action(({ blackboard: bb }) => {
            bb.patrolIndex = (bb.patrolIndex + 1) % bb.patrolPoints.length
            return SUCCESS
        })

        const chase = new Sequence([sees, moveTo(bb => bb.player)])
        const patrol = new Sequence([
            moveTo(bb => bb.patrolPoints[bb.patrolIndex]),
            advancePatrol
        ])

        const root = new Selector([chase, patrol])

        const bt = this.flow.addProcessor(BehaviorTreeProcessor.EVENT_TYPE, BehaviorTreeProcessor)
        bt.add('agent', root, blackboard)

        // Suppress lint-style unused FAILURE
        void FAILURE
    }

}

export default BehaviorTreeDemo

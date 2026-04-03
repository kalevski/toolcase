interface LSystemConfig {
    axiom: string
    rules: Record<string, string>
}

class LSystem {

    private config: LSystemConfig

    readonly state: string = ''

    readonly iteration: number = 0

    constructor(config: LSystemConfig) {
        this.config = config
        this.state += config.axiom
    }

    iterate(): string {
        let sequence = ''
        for (const rule of this.state.split('')) {
            const resolved = this.config.rules[rule]
            if (typeof resolved !== 'string') {
                sequence += rule
                continue
            }
            sequence += resolved
        }
        ;(this as any).iteration++
        ;(this as any).state = sequence
        return sequence
    }
}

export default LSystem
